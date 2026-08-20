import mongoose from 'mongoose';
import { ApiError } from '../utils/ApiError.js';
import { Gig } from '../models/gig.model.js';
import { Application, REJECTION_REASON_CODES } from '../models/application.model.js';
import { assertGigIsOpen } from './gig.service.js';
import { getMyProfile } from './profile.service.js';

// Source status -> target status -> which kind of actor may trigger that
// move. Modeled as data, not a chain of conditionals, so Sprint 2's hiring
// flow and Sprint 3's auto-close rule can extend it safely. A status with
// no entry here has no way out of it, so any move out of one falls straight
// through to the 409 below — nothing reopens a finished application, and
// status never moves backwards. Rejected, Withdrawn and Closed – position
// filled are the three that end there; Hired's single outgoing move is to
// Completed, added by GL-218 so the work itself can be marked finished.
//
// 'business' means the business that posted the gig, specifically — not
// any business. 'applicant' means the seeker who owns the application.
// 'system' means no HTTP-authenticated actor at all: it is set by
// Sprint 2/3 auto-close code calling this function directly, never by a
// request from a business or a seeker.
const TRANSITION_RULES = {
  applied: {
    viewed: 'business',
    rejected: 'business',
    withdrawn: 'applicant',
    closed_filled: 'system',
  },
  viewed: {
    shortlisted: 'business',
    rejected: 'business',
    withdrawn: 'applicant',
    closed_filled: 'system',
  },
  shortlisted: {
    hired: 'business',
    rejected: 'business',
    withdrawn: 'applicant',
  },
  // The only way out of Hired, and only for the business that posted the
  // gig. Nothing else is added here: `applied -> hired` and `viewed -> hired`
  // stay refused, so hiring still requires shortlisting first — that chain is
  // what the seeker's tracker exists to show.
  hired: {
    completed: 'business',
  },
};

const TERMINAL_STATUSES = ['hired', 'rejected', 'withdrawn', 'closed_filled'];
// Completed is live: finishing the work is not leaving the process, so the
// gig's applicantCount must not fall when hire -> complete happens. A count
// that drops when a job is done reads as a bug.
const LIVE_STATUSES = ['applied', 'viewed', 'shortlisted', 'hired', 'completed'];

// The two Skill Trial reason codes only make sense once a gig can carry a
// trial, which arrives in Sprint 3. `gig.skillTrial` does not exist on the
// Gig model yet, so this is always undefined today and the guard below
// always rejects them — trivially correct until Sprint 3 adds the field,
// at which point this starts working with no change needed here.
const TRIAL_REASON_CODES = ['skill_trial_not_passed', 'skill_trial_not_attempted'];
const BUSINESS_SELECTABLE_REASON_CODES = REJECTION_REASON_CODES.filter(
  (code) => code !== 'positions_filled',
);

const FORBIDDEN_ERROR = () =>
  new ApiError(403, 'FORBIDDEN', 'You do not have permission to perform this action.');

// The applicant count lives on the gig — declared and defaulted to zero by
// GL-158 — but is maintained here, not by the marketplace. It counts live
// applications only (Applied, Viewed, Shortlisted, Hired); Withdrawn and
// Rejected applications drop out of it. Every write to it goes through this
// helper, in the same operation as the status change that caused it, never
// a separate call a client can forget to make — a count that drifts from
// reality is worse than no count. GL-110 calls this directly with +1 when
// an application is created; transitionApplicationStatus below calls it
// with -1 the moment an application leaves the live set.
export const adjustGigApplicantCount = async (gigId, delta) => {
  const gig = await Gig.findByIdAndUpdate(
    gigId,
    { $inc: { applicantCount: delta } },
    { returnDocument: 'after', runValidators: true },
  );

  return gig?.applicantCount;
};

// Applying is not blocked by an empty profile — deciding someone isn't ready
// is the business's job, not the app's. `profileIncomplete` just tells the
// client whether to warn the seeker before they submit.
const buildProfileSnapshot = (profile) => ({
  name: profile.name,
  headline: profile.bio,
  experience: profile.workExperience,
  education: profile.education,
  rating: profile.ratingSummary,
});

// GL-182: creates the application a seeker submits for a gig. The profile
// snapshot is read through profile.service.js rather than profile.model.js
// directly, so the ownership boundary with E2 holds. Status and appliedAt
// are schema defaults here, never accepted from a caller.
export const applyToGig = async (gigId, user) => {
  const gig = await assertGigIsOpen(gigId);
  const profile = await getMyProfile(user);

  const profileSnapshot = buildProfileSnapshot(profile);
  const profileIncomplete = profile.workExperience.length === 0 && profile.education.length === 0;

  let application;
  try {
    application = await Application.create({
      gig: gig._id,
      applicant: user._id,
      profileSnapshot,
    });
  } catch (err) {
    // Same trap GL-15 hit with duplicate emails: the unique (gig, applicant)
    // index is what actually enforces "one application per seeker per gig",
    // so the duplicate-key error is translated here rather than reaching the
    // client as a 500. Holds whether the earlier application is live,
    // withdrawn or rejected — the index doesn't distinguish.
    if (err.code === 11000) {
      throw new ApiError(
        409,
        'APPLICATION_ALREADY_EXISTS',
        'You have already applied to this gig.',
      );
    }
    throw err;
  }

  await adjustGigApplicantCount(gig._id, 1);

  return { application: application.toJSON(), profileIncomplete };
};

// Confirms `actor` — a plain `{ id, role }`, or null/undefined for a
// system-triggered call — is the kind of actor this transition requires.
// Returns the gig when it had to be fetched to check business ownership,
// so the caller can reuse it instead of fetching twice.
const assertActorPermitted = async (application, actorKind, actor) => {
  if (actorKind === 'system') {
    if (actor) throw FORBIDDEN_ERROR();
    return null;
  }

  if (!actor) throw FORBIDDEN_ERROR();

  if (actorKind === 'applicant') {
    if (actor.role !== 'seeker' || application.applicant.toString() !== actor.id.toString()) {
      throw FORBIDDEN_ERROR();
    }
    return null;
  }

  // actorKind === 'business': must be the business that posted this gig,
  // not merely a business account.
  if (actor.role !== 'business') throw FORBIDDEN_ERROR();

  const gig = await Gig.findById(application.gig);
  if (!gig || gig.postedBy.toString() !== actor.id.toString()) {
    throw FORBIDDEN_ERROR();
  }

  return gig;
};

const assertValidRejection = (reason, gig) => {
  const code = reason?.code;

  if (!code) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'A rejection reason code is required.', [
      { field: 'reasonCode', message: 'reasonCode is required when rejecting an application' },
    ]);
  }

  if (!BUSINESS_SELECTABLE_REASON_CODES.includes(code)) {
    throw new ApiError(
      400,
      'VALIDATION_ERROR',
      'This reason code cannot be selected for a rejection.',
      [{ field: 'reasonCode', message: `"${code}" is not a valid rejection reason` }],
    );
  }

  if (TRIAL_REASON_CODES.includes(code) && !gig?.skillTrial) {
    throw new ApiError(
      400,
      'VALIDATION_ERROR',
      'This reason code requires the gig to have carried a skill trial.',
      [
        {
          field: 'reasonCode',
          message: `"${code}" requires the gig to have carried a skill trial`,
        },
      ],
    );
  }
};

// The single code path allowed to change an application's status — nothing
// else in this sprint or the next two writes the status field. Pure with
// respect to HTTP: takes the application, the target status, the acting
// user and a reason, and throws ApiError; it never touches req or res, so
// GL-110's endpoints and later hiring/auto-close callers can use it directly.
//
// `actor` is `{ id, role }` for an HTTP-authenticated caller, or
// null/undefined for a system-triggered call. `reason` is `{ code, note }`,
// only inspected when rejecting.
export const transitionApplicationStatus = async (application, targetStatus, actor, reason) => {
  const currentStatus = application.status;
  const permittedTargets = TRANSITION_RULES[currentStatus] || {};
  const requiredActorKind = permittedTargets[targetStatus];

  if (!requiredActorKind) {
    throw new ApiError(
      409,
      'INVALID_APPLICATION_TRANSITION',
      `Cannot move an application from "${currentStatus}" to "${targetStatus}".`,
    );
  }

  const gig = await assertActorPermitted(application, requiredActorKind, actor);

  if (targetStatus === 'rejected') {
    assertValidRejection(reason, gig);
    application.rejectionReasonCode = reason.code;
    if (reason.note !== undefined) {
      application.rejectionNote = reason.note;
    }
  }

  const wasLive = LIVE_STATUSES.includes(currentStatus);
  const isLive = LIVE_STATUSES.includes(targetStatus);

  application.status = targetStatus;

  // Set once, on the way in, and never touched again — that is what makes
  // an applicant's history tamper-proof.
  if (targetStatus === 'viewed' && !application.viewedAt) {
    application.viewedAt = new Date();
  }

  if (targetStatus === 'completed' && !application.completedAt) {
    application.completedAt = new Date();
  }

  if (TERMINAL_STATUSES.includes(targetStatus) && !application.decidedAt) {
    application.decidedAt = new Date();
  }

  await application.save();

  // Every transition this function permits either stays within the live
  // set (Applied -> Viewed -> Shortlisted -> Hired) or leaves it for good —
  // terminal statuses have no outgoing moves, so this only ever fires once
  // per application, adjusting the gig in the same operation as the status
  // change that caused it.
  if (wasLive && !isLive) {
    await adjustGigApplicantCount(application.gig, -1);
  }

  return application;
};

// The read side of the boundary with Reviews (GL-195): a review is created
// against an application id, not a user id, and needs to know who the two
// parties are and what status the application is at. This is the only path
// that boundary is allowed to take — callers outside this component must
// never import application.model.js directly to get there.
export const getApplicationWithParties = async (id) => {
  if (!mongoose.isValidObjectId(id)) {
    throw new ApiError(404, 'NOT_FOUND', 'Application not found.');
  }

  const application = await Application.findById(id);

  if (!application) {
    throw new ApiError(404, 'NOT_FOUND', 'Application not found.');
  }

  const gig = await Gig.findById(application.gig);

  return {
    application,
    applicantId: application.applicant.toString(),
    businessId: gig?.postedBy?.toString(),
  };
};

// Never the full gig (10.1) — just enough for a seeker or business to
// recognise which posting an application belongs to in a list or detail
// view. A deleted gig (10.9 has no cascade) reads back as null rather than
// breaking the response.
const toGigSummary = (gig) => {
  if (!gig) return null;

  const gigJson = gig.toJSON();

  return {
    id: gigJson.id,
    title: gigJson.title,
    payAmount: gigJson.payAmount,
    payType: gigJson.payType,
    city: gigJson.city,
    status: gigJson.status,
  };
};

// GL-183: the signed-in seeker's own applications, newest first, each with
// a summary of the gig it belongs to. Scoped to `applicant: userId` only —
// there is no parameter that reaches another seeker's applications.
export const listMyApplications = async (userId) => {
  const applications = await Application.find({ applicant: userId }).sort({
    createdAt: -1,
    _id: -1,
  });

  const gigIds = [...new Set(applications.map((application) => application.gig.toString()))];
  const gigs = await Gig.find({ _id: { $in: gigIds } });
  const gigById = new Map(gigs.map((gig) => [gig.id, gig]));

  return {
    applications: applications.map((application) => ({
      ...application.toJSON(),
      gig: toGigSummary(gigById.get(application.gig.toString())),
    })),
  };
};

// GL-183: one application, to the seeker who owns it or the business that
// posted the gig — 403 to anyone else, checked after existence so a missing
// id always 404s before a wrong party ever sees a 403 (mirrors gig.service's
// findOwnedGig ordering). The full document is returned, including the
// rejection reason/note once decided — shown exactly as the business wrote
// it, no softening. No endpoint here can reach another applicant's
// application: this only ever resolves the one id given.
export const getApplicationById = async (id, actor) => {
  const { application, applicantId, businessId } = await getApplicationWithParties(id);

  const isApplicant = actor.role === 'seeker' && applicantId === actor.id.toString();
  const isBusiness = actor.role === 'business' && businessId === actor.id.toString();

  if (!isApplicant && !isBusiness) {
    throw new ApiError(403, 'FORBIDDEN', 'You do not have permission to perform this action.');
  }

  const gig = await Gig.findById(application.gig);

  return {
    application: { ...application.toJSON(), gig: toGigSummary(gig) },
  };
};

// GL-184: moves an application to Withdrawn through transitionApplicationStatus
// (GL-179) — never a direct status write. That function already enforces
// "only the applicant" (403 for anyone else, including the business or a
// different seeker) and "only from Applied, Viewed or Shortlisted" (a Hired
// application has no outgoing move in TRANSITION_RULES, so it falls through
// to 409 INVALID_APPLICATION_TRANSITION — the same guard every other
// terminal status gets, not a withdraw-specific check). It also decrements
// the applicant count in the same operation, since Withdrawn leaves the live
// set. The application is never deleted or hidden — it stays visible to the
// business exactly where it was, just with a new status.
export const withdrawApplication = async (id, actor) => {
  const { application } = await getApplicationWithParties(id);

  const updated = await transitionApplicationStatus(application, 'withdrawn', actor);
  const gig = await Gig.findById(updated.gig);

  return {
    application: { ...updated.toJSON(), gig: toGigSummary(gig) },
  };
};

// GL-248: moves a hired application to Completed through
// transitionApplicationStatus — the same single entry point withdrawing uses,
// and there is no second path that writes the status, not even for testing.
// That function enforces "only the business that posted the gig" by ownership
// (403 for a seeker, including the applicant themselves, and for a business
// that owns a different gig) and "only from Hired" (any other source status
// has no `completed` target in TRANSITION_RULES, so it falls through to 409
// INVALID_APPLICATION_TRANSITION naming both statuses). It also stamps
// completedAt once. No reason is passed: completion takes none, and must not
// acquire one — reasons belong to rejections. The applicant count is
// untouched, since Completed is in the live set.
export const completeApplication = async (id, actor) => {
  const { application } = await getApplicationWithParties(id);

  const updated = await transitionApplicationStatus(application, 'completed', actor);
  const gig = await Gig.findById(updated.gig);

  return {
    application: { ...updated.toJSON(), gig: toGigSummary(gig) },
  };
};

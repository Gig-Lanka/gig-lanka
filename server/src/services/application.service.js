import { ApiError } from '../utils/ApiError.js';
import { Gig } from '../models/gig.model.js';
import { REJECTION_REASON_CODES } from '../models/application.model.js';

// Source status -> target status -> which kind of actor may trigger that
// move. Modeled as data, not a chain of conditionals, so Sprint 2's hiring
// flow and Sprint 3's auto-close rule can extend it safely. Terminal
// statuses (Hired, Rejected, Withdrawn, Closed – position filled) have no
// entry here, so any move out of one of them falls straight through to the
// 409 below — nothing reopens a terminal application, and status never
// moves backwards.
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
};

const TERMINAL_STATUSES = ['hired', 'rejected', 'withdrawn', 'closed_filled'];
const LIVE_STATUSES = ['applied', 'viewed', 'shortlisted', 'hired'];

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

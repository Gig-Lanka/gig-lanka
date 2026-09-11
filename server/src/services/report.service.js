import mongoose from 'mongoose';
import { ApiError } from '../utils/ApiError.js';
import { Report } from '../models/report.model.js';
import { User } from '../models/user.model.js';
import { Gig } from '../models/gig.model.js';
import { getPublicIdentity } from './profile.service.js';

// Checked before anything else — including who's asking — so a report
// against a bad id always 404s the same way, and refusal codes can never be
// used to probe which ids exist. Mirrors the existence-then-everything-else
// ordering gig.service.js's findOwnedGig already uses for update, close and
// delete. A malformed id is indistinguishable from an unknown one here: both
// 404, never 400.
const assertTargetExists = async (targetType, targetId) => {
  if (!mongoose.isValidObjectId(targetId)) {
    throw new ApiError(
      404,
      'NOT_FOUND',
      targetType === 'user' ? 'User not found.' : 'Gig not found.',
    );
  }

  if (targetType === 'user') {
    const user = await User.findById(targetId);
    if (!user) {
      throw new ApiError(404, 'NOT_FOUND', 'User not found.');
    }
    return user;
  }

  const gig = await Gig.findById(targetId);
  if (!gig) {
    throw new ApiError(404, 'NOT_FOUND', 'Gig not found.');
  }
  return gig;
};

// A user reporting themselves, or a business reporting its own gig, is
// refused before a report is ever written. Not a rule the unique index could
// enforce — that index only stops a *second* report against the same
// target, and a first self-report would pass it cleanly.
const assertNotReportingSelf = (targetType, target, actorId) => {
  const targetOwnerId = targetType === 'user' ? target._id : target.postedBy;

  if (targetOwnerId.toString() === actorId.toString()) {
    const message =
      targetType === 'user' ? 'You cannot report yourself.' : 'You cannot report your own gig.';

    throw new ApiError(400, 'VALIDATION_ERROR', message, [{ field: 'targetId', message }]);
  }
};

// GL-367: creates a report for any signed-in user, either role — admins are
// kept out at the route via requireRole, not here. Existence and
// self-reporting are both resolved before the write is attempted, so the
// unique-index 409 below only ever fires for a genuine repeat report against
// a real, distinct target.
//
// Nothing here notifies the reported party or touches their profile, rating,
// gigs or applications: a report is a write to this collection alone, read
// back only by its own reporter (and, outside this story's scope, an admin).
export const createReport = async (actor, body) => {
  const { targetType, targetId, reasonCode, note } = body;

  const target = await assertTargetExists(targetType, targetId);
  assertNotReportingSelf(targetType, target, actor.id);

  try {
    const report = await Report.create({
      reporter: actor.id,
      targetType,
      targetId,
      reasonCode,
      note,
    });

    return report.toJSON();
  } catch (err) {
    // The unique (reporter, targetType, targetId) index is what actually
    // enforces "one open report per reporter per target" — the duplicate-key
    // error is translated here rather than reaching the client as a 500, the
    // same trap POST /api/auth/register and the apply endpoint have both
    // been caught by.
    if (err.code === 11000) {
      throw new ApiError(
        409,
        'REPORT_ALREADY_EXISTS',
        'You already have an open report against this target.',
      );
    }
    throw err;
  }
};

// Never the full gig — just enough to recognise which posting a report
// belongs to, the same trimmed shape application.service.js's toGigSummary
// uses. A deleted gig (a business can delete its own) reads back as null
// rather than breaking the response.
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

// The target summary carried on each of the caller's own reports — a public
// identity for a user target, a gig summary for a gig target. Deliberately
// nothing about any *other* report against the same target: no count, no
// "N others reported this". That's another reporter's action, not this
// caller's own, and surfacing it would double as a way to gauge how much
// attention a target is drawing.
const getTargetSummary = async (targetType, targetId) => {
  if (targetType === 'user') {
    return getPublicIdentity(targetId);
  }

  const gig = await Gig.findById(targetId);
  return toGigSummary(gig);
};

// GL-368: the reports the signed-in caller has filed, newest first, each
// with its target's summary attached. Scoped to `reporter: callerId` only —
// there is no parameter that reaches another reporter's reports, matching
// listMyApplications and listMyReviews. Unpaginated, like those two: a
// caller's own list is expected to return in full.
export const listMyReports = async (callerId) => {
  const reports = await Report.find({ reporter: callerId }).sort({ createdAt: -1, _id: -1 });

  const reportsWithTarget = await Promise.all(
    reports.map(async (report) => {
      const reportJson = report.toJSON();
      return { ...reportJson, target: await getTargetSummary(reportJson.targetType, reportJson.targetId) };
    }),
  );

  return { reports: reportsWithTarget };
};

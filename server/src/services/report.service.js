import mongoose from 'mongoose';
import { ApiError } from '../utils/ApiError.js';
import { Report } from '../models/report.model.js';
import { User } from '../models/user.model.js';
import { Gig } from '../models/gig.model.js';

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

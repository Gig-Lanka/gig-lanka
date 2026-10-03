import mongoose from 'mongoose';
import { User } from '../models/user.model.js';
import { ApiError } from '../utils/ApiError.js';
import { revokeAllRefreshTokensForUser } from './token.service.js';

// A malformed id is indistinguishable from an unknown one: both 404. Mirrors
// report.service.js's assertTargetExists and gig.service.js's findOwnedGig.
const findTargetUser = async (id) => {
  if (!mongoose.isValidObjectId(id)) {
    throw new ApiError(404, 'NOT_FOUND', 'User not found.');
  }

  const user = await User.findById(id);

  if (!user) {
    throw new ApiError(404, 'NOT_FOUND', 'User not found.');
  }

  return user;
};

// GL-397 AC2/AC4. Suspending a self-deactivated account is allowed on
// purpose — it records the moderation decision even though the account
// already can't sign in, so isActive is never consulted here.
export const suspendAccount = async (id) => {
  const user = await findTargetUser(id);

  if (user.role === 'admin') {
    throw new ApiError(403, 'FORBIDDEN', 'Admins cannot be suspended.');
  }

  if (user.suspendedAt) {
    throw new ApiError(409, 'ACCOUNT_ALREADY_SUSPENDED', 'This account is already suspended.');
  }

  user.suspendedAt = new Date();
  await user.save();

  await revokeAllRefreshTokensForUser(user._id);

  return { userId: user.id, status: 'suspended', suspendedAt: user.suspendedAt };
};

// GL-397 AC3. Clears suspendedAt only — isActive is never touched, so an
// account that deactivated itself before being suspended stays deactivated
// once reinstated, exactly as the story requires.
export const reinstateAccount = async (id) => {
  const user = await findTargetUser(id);

  if (!user.suspendedAt) {
    throw new ApiError(409, 'ACCOUNT_NOT_SUSPENDED', 'This account is not suspended.');
  }

  user.suspendedAt = null;
  await user.save();

  return { userId: user.id, status: 'active' };
};

// GL-455: which of these accounts Gig Lanka has suspended, for the admin
// report queue's target summaries. Account status is this service's, so
// report.service.js reads it through here rather than the User model. One
// query for a whole page; only suspendedAt counts - a self-deactivated
// account isn't suspended, and there's nothing for an admin to reinstate.
export const getSuspendedUserIdSet = async (userIds) => {
  const uniqueIds = [...new Set(userIds.map((id) => id.toString()))];

  if (uniqueIds.length === 0) return new Set();

  const users = await User.find({ _id: { $in: uniqueIds }, suspendedAt: { $ne: null } })
    .select('_id')
    .lean();

  return new Set(users.map((user) => user._id.toString()));
};

import bcrypt from 'bcryptjs';
import { User } from '../models/user.model.js';
import { ApiError } from '../utils/ApiError.js';
import {
  issueTokens,
  rotateRefreshToken,
  revokeRefreshToken,
  revokeAllRefreshTokensForUser,
} from './token.service.js';

const SALT_ROUNDS = 10;

export const registerUser = async ({ email, password, role }) => {
  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

  let user;
  try {
    user = await User.create({ email, passwordHash, role });
  } catch (err) {
    if (err.code === 11000) {
      throw new ApiError(409, 'EMAIL_ALREADY_EXISTS', 'An account with this email already exists.');
    }
    throw err;
  }

  const { accessToken, refreshToken } = await issueTokens(user);

  return { user, accessToken, refreshToken };
};

export const refreshTokens = (refreshToken) => rotateRefreshToken(refreshToken);

export const logoutUser = (refreshToken) => revokeRefreshToken(refreshToken);

export const loginUser = async ({ email, password }) => {
  const user = await User.findOne({ email });

  if (!user) {
    throw new ApiError(401, 'INVALID_CREDENTIALS', 'Email or password is incorrect.');
  }

  const isMatch = await bcrypt.compare(password, user.passwordHash);

  if (!isMatch) {
    throw new ApiError(401, 'INVALID_CREDENTIALS', 'Email or password is incorrect.');
  }

  const { accessToken, refreshToken } = await issueTokens(user);

  return { user, accessToken, refreshToken };
};

export const changeUserPassword = async (user, { currentPassword, newPassword }) => {
  const isMatch = await bcrypt.compare(currentPassword, user.passwordHash);

  if (!isMatch) {
    throw new ApiError(401, 'INVALID_CURRENT_PASSWORD', 'Current password is incorrect.');
  }

  const isSamePassword = await bcrypt.compare(newPassword, user.passwordHash);

  if (isSamePassword) {
    throw new ApiError(
      400,
      'PASSWORD_UNCHANGED',
      'New password must be different from your current password.',
    );
  }

  user.passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
  await user.save();

  await revokeAllRefreshTokensForUser(user._id);

  return issueTokens(user);
};

export const deactivateOwnAccount = async (user) => {
  user.isActive = false;
  await user.save();

  await revokeAllRefreshTokensForUser(user._id);
};

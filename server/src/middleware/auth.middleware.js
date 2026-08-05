import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { User } from '../models/user.model.js';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const requireAuth = asyncHandler(async (req, res, next) => {
  const header = req.headers.authorization;

  if (!header) {
    throw new ApiError(401, 'AUTH_HEADER_MISSING', 'Authorization header is missing.');
  }

  if (!header.startsWith('Bearer ') || !header.slice(7).trim()) {
    throw new ApiError(
      401,
      'AUTH_HEADER_MALFORMED',

      'Authorization header must be in the format "Bearer <token>".',
    );
  }

  const token = header.slice(7);

  let decoded;
  try {
    decoded = jwt.verify(token, env.jwtAccessSecret);
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      throw new ApiError(401, 'TOKEN_EXPIRED', 'Access token has expired.');
    }
    throw new ApiError(401, 'TOKEN_INVALID', 'Access token is invalid.');
  }

  const user = await User.findById(decoded.id);

  if (!user) {
    throw new ApiError(401, 'TOKEN_INVALID', 'Access token is invalid.');
  }

  req.user = user;
  next();
});

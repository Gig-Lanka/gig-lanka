import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { User } from '../models/user.model.js';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const UNAUTHENTICATED = () =>
  new ApiError(401, 'UNAUTHENTICATED', 'You must be logged in to do this.');

export const requireAuth = asyncHandler(async (req, res, next) => {
  const header = req.headers.authorization;
  const token = header?.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token) {
    throw UNAUTHENTICATED();
  }

  let decoded;
  try {
    decoded = jwt.verify(token, env.jwtAccessSecret);
  } catch {
    throw UNAUTHENTICATED();
  }

  const user = await User.findById(decoded.id);

  if (!user) {
    throw UNAUTHENTICATED();
  }

  req.user = user;
  next();
});

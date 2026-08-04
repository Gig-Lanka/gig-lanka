import bcrypt from "bcryptjs";
import { User } from "../models/user.model.js";
import { ApiError } from "../utils/ApiError.js";
import { issueTokens, rotateRefreshToken } from "./token.service.js";

const SALT_ROUNDS = 10;

export const registerUser = async ({ email, password, role }) => {
  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

  let user;
  try {
    user = await User.create({ email, passwordHash, role });
  } catch (err) {
    if (err.code === 11000) {
      throw new ApiError(409, "EMAIL_ALREADY_EXISTS", "An account with this email already exists.");
    }
    throw err;
  }

  const { accessToken, refreshToken } = await issueTokens(user);

  return { user, accessToken, refreshToken };
};

export const refreshTokens = (refreshToken) => rotateRefreshToken(refreshToken);

export const loginUser = async ({ email, password }) => {
  const user = await User.findOne({ email });

  if (!user) {
    throw new ApiError(401, "INVALID_CREDENTIALS", "Email or password is incorrect.");
  }

  const isMatch = await bcrypt.compare(password, user.passwordHash);

  if (!isMatch) {
    throw new ApiError(401, "INVALID_CREDENTIALS", "Email or password is incorrect.");
  }

  const { accessToken, refreshToken } = await issueTokens(user);

  return { user, accessToken, refreshToken };
};

import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { env } from "../config/env.js";
import { User } from "../models/user.model.js";
import { RefreshToken } from "../models/refreshToken.model.js";
import { ApiError } from "../utils/ApiError.js";

const SALT_ROUNDS = 10;

const generateTokens = async (user) => {
  const accessToken = jwt.sign({ sub: user._id.toString(), role: user.role }, env.jwtAccessSecret, {
    expiresIn: env.jwtAccessExpiresIn,
  });

  const refreshToken = jwt.sign({ sub: user._id.toString() }, env.jwtRefreshSecret, {
    expiresIn: env.jwtRefreshExpiresIn,
  });

  const { exp } = jwt.decode(refreshToken);
  await RefreshToken.create({
    token: refreshToken,
    user: user._id,
    expiresAt: new Date(exp * 1000),
  });

  return { accessToken, refreshToken };
};

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

  const { accessToken, refreshToken } = await generateTokens(user);

  return { user, accessToken, refreshToken };
};

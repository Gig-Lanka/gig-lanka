import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import { RefreshToken } from "../models/refreshToken.model.js";

const signAccessToken = (user) =>
  jwt.sign({ id: user._id.toString(), role: user.role }, env.jwtAccessSecret, {
    expiresIn: env.jwtAccessExpiresIn,
  });

const signRefreshToken = (user) =>
  jwt.sign({ id: user._id.toString(), role: user.role }, env.jwtRefreshSecret, {
    expiresIn: env.jwtRefreshExpiresIn,
  });

export const issueTokens = async (user) => {
  const accessToken = signAccessToken(user);
  const refreshToken = signRefreshToken(user);

  const { exp } = jwt.decode(refreshToken);
  await RefreshToken.create({
    token: refreshToken,
    user: user._id,
    expiresAt: new Date(exp * 1000),
  });

  return { accessToken, refreshToken };
};

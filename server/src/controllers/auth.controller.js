import { asyncHandler } from "../utils/asyncHandler.js";
import { sendSuccess } from "../utils/response.js";
import { registerUser, loginUser, refreshTokens } from "../services/auth.service.js";

export const register = asyncHandler(async (req, res) => {
  const { user, accessToken, refreshToken } = await registerUser(req.body);

  sendSuccess(res, { user, accessToken, refreshToken }, 201);
});

export const login = asyncHandler(async (req, res) => {
  const { user, accessToken, refreshToken } = await loginUser(req.body);

  sendSuccess(res, { user, accessToken, refreshToken }, 200);
});

export const refresh = asyncHandler(async (req, res) => {
  const { accessToken, refreshToken } = await refreshTokens(req.body.refreshToken);

  sendSuccess(res, { accessToken, refreshToken }, 200);
});

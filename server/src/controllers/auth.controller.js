import { asyncHandler } from "../utils/asyncHandler.js";
import { sendSuccess } from "../utils/response.js";
import { registerUser } from "../services/auth.service.js";

export const register = asyncHandler(async (req, res) => {
  const { user, accessToken, refreshToken } = await registerUser(req.body);

  sendSuccess(res, { user, accessToken, refreshToken }, 201);
});

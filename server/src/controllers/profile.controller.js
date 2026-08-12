import { asyncHandler } from '../utils/asyncHandler.js';
import { sendSuccess } from '../utils/response.js';
import {
  getMyProfile as getMyProfileService,
  updateMyProfile as updateMyProfileService,
  getPublicProfile as getPublicProfileService,
} from '../services/profile.service.js';

export const getMyProfile = asyncHandler(async (req, res) => {
  const profile = await getMyProfileService(req.user);

  sendSuccess(res, { profile }, 200);
});

export const updateMyProfile = asyncHandler(async (req, res) => {
  const profile = await updateMyProfileService(req.user, req.body);

  sendSuccess(res, { profile }, 200);
});

export const getPublicProfile = asyncHandler(async (req, res) => {
  const profile = await getPublicProfileService(req.params.userId);

  sendSuccess(res, { profile }, 200);
});

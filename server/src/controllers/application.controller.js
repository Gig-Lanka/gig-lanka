import { asyncHandler } from '../utils/asyncHandler.js';
import { sendSuccess } from '../utils/response.js';
import { applyToGig as applyToGigService } from '../services/application.service.js';

export const applyToGig = asyncHandler(async (req, res) => {
  const result = await applyToGigService(req.params.gigId, req.user);

  sendSuccess(res, result, 201);
});

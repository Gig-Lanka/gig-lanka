import { asyncHandler } from '../utils/asyncHandler.js';
import { sendSuccess } from '../utils/response.js';
import { createReview as createReviewService } from '../services/review.service.js';

export const createReview = asyncHandler(async (req, res) => {
  const actor = { id: req.user.id, role: req.user.role };
  const review = await createReviewService(req.params.applicationId, actor, req.body);

  sendSuccess(res, { review }, 201);
});

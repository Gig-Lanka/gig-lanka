import { asyncHandler } from '../utils/asyncHandler.js';
import { sendSuccess } from '../utils/response.js';
import {
  createReview as createReviewService,
  listUserReviews as listUserReviewsService,
  listMyReviews as listMyReviewsService,
} from '../services/review.service.js';

export const createReview = asyncHandler(async (req, res) => {
  const actor = { id: req.user.id, role: req.user.role };
  const review = await createReviewService(req.params.applicationId, actor, req.body);

  sendSuccess(res, { review }, 201);
});

export const getUserReviews = asyncHandler(async (req, res) => {
  const result = await listUserReviewsService(req.params.userId, req.query);

  sendSuccess(res, result, 200);
});

export const getMyReviews = asyncHandler(async (req, res) => {
  const result = await listMyReviewsService(req.user.id);

  sendSuccess(res, result, 200);
});

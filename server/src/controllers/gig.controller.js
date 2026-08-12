import { asyncHandler } from '../utils/asyncHandler.js';
import { sendSuccess } from '../utils/response.js';
import {
  createGig as createGigService,
  listOpenGigs,
  getGigById,
} from '../services/gig.service.js';

export const createGig = asyncHandler(async (req, res) => {
  const gig = await createGigService(req.body, req.user.id);

  sendSuccess(res, { gig }, 201);
});

export const listGigs = asyncHandler(async (req, res) => {
  const result = await listOpenGigs(req.query);

  sendSuccess(res, result, 200);
});

export const getGig = asyncHandler(async (req, res) => {
  const result = await getGigById(req.params.id);

  sendSuccess(res, result, 200);
});

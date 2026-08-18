import { asyncHandler } from '../utils/asyncHandler.js';
import { sendSuccess } from '../utils/response.js';
import {
  createGig as createGigService,
  listOpenGigs,
  getGigById,
  listMyGigs,
  updateGig as updateGigService,
  closeGig as closeGigService,
  deleteGig as deleteGigService,
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

export const getMyGigs = asyncHandler(async (req, res) => {
  const result = await listMyGigs(req.user.id);

  sendSuccess(res, result, 200);
});

export const updateGig = asyncHandler(async (req, res) => {
  const gig = await updateGigService(req.params.id, req.body, req.user.id);

  sendSuccess(res, { gig }, 200);
});

export const closeGig = asyncHandler(async (req, res) => {
  const gig = await closeGigService(req.params.id, req.user.id);

  sendSuccess(res, { gig }, 200);
});

export const deleteGig = asyncHandler(async (req, res) => {
  await deleteGigService(req.params.id, req.user.id);

  sendSuccess(res, null, 200);
});

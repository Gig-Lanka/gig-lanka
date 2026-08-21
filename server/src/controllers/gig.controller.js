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
import { getViewerApplication } from '../services/application.service.js';

export const createGig = asyncHandler(async (req, res) => {
  const gig = await createGigService(req.body, req.user.id);

  sendSuccess(res, { gig }, 201);
});

export const listGigs = asyncHandler(async (req, res) => {
  const result = await listOpenGigs(req.query);

  sendSuccess(res, result, 200);
});

// optionalAuth (GL-213) sits on this route so req.user is set for a valid
// signed-in caller and left unset for a guest or an expired/invalid token -
// either way this composes gig.service.js's read with application.service.js's
// viewerApplication read here, rather than gig.service.js importing the
// application service, which would close an import cycle (application.service.js
// already imports gig.service.js for assertGigIsOpen).
export const getGig = asyncHandler(async (req, res) => {
  const result = await getGigById(req.params.id);
  const viewerApplication = await getViewerApplication(req.params.id, req.user);

  sendSuccess(res, { ...result, viewerApplication }, 200);
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

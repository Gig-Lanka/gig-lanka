import { asyncHandler } from '../utils/asyncHandler.js';
import { sendSuccess } from '../utils/response.js';
import {
  applyToGig as applyToGigService,
  listMyApplications as listMyApplicationsService,
  getApplicationById as getApplicationByIdService,
  withdrawApplication as withdrawApplicationService,
  completeApplication as completeApplicationService,
  listApplicationsForGig as listApplicationsForGigService,
  listApplicationsForMyGigs as listApplicationsForMyGigsService,
  viewApplication as viewApplicationService,
  shortlistApplication as shortlistApplicationService,
  hireApplication as hireApplicationService,
  rejectApplication as rejectApplicationService,
} from '../services/application.service.js';

export const applyToGig = asyncHandler(async (req, res) => {
  const result = await applyToGigService(req.params.gigId, req.user, req.body);

  sendSuccess(res, result, 201);
});

export const getMyApplications = asyncHandler(async (req, res) => {
  const result = await listMyApplicationsService(req.user.id);

  sendSuccess(res, result, 200);
});

export const getApplication = asyncHandler(async (req, res) => {
  const actor = { id: req.user.id, role: req.user.role };
  const result = await getApplicationByIdService(req.params.id, actor);

  sendSuccess(res, result, 200);
});

export const withdrawApplication = asyncHandler(async (req, res) => {
  const actor = { id: req.user.id, role: req.user.role };
  const result = await withdrawApplicationService(req.params.id, actor);

  sendSuccess(res, result, 200);
});

export const completeApplication = asyncHandler(async (req, res) => {
  const actor = { id: req.user.id, role: req.user.role };
  const result = await completeApplicationService(req.params.id, actor);

  sendSuccess(res, result, 200);
});

export const viewApplication = asyncHandler(async (req, res) => {
  const actor = { id: req.user.id, role: req.user.role };
  const result = await viewApplicationService(req.params.id, actor);

  sendSuccess(res, result, 200);
});

export const shortlistApplication = asyncHandler(async (req, res) => {
  const actor = { id: req.user.id, role: req.user.role };
  const result = await shortlistApplicationService(req.params.id, actor);

  sendSuccess(res, result, 200);
});

export const hireApplication = asyncHandler(async (req, res) => {
  const actor = { id: req.user.id, role: req.user.role };
  const result = await hireApplicationService(req.params.id, actor);

  sendSuccess(res, result, 200);
});

export const rejectApplication = asyncHandler(async (req, res) => {
  const actor = { id: req.user.id, role: req.user.role };
  const result = await rejectApplicationService(req.params.id, actor, req.body);

  sendSuccess(res, result, 200);
});

export const getGigApplications = asyncHandler(async (req, res) => {
  const result = await listApplicationsForGigService(req.params.gigId, req.user.id, req.query);

  sendSuccess(res, result, 200);
});

export const getApplicationsForMyGigs = asyncHandler(async (req, res) => {
  const result = await listApplicationsForMyGigsService(req.user.id, req.query);

  sendSuccess(res, result, 200);
});

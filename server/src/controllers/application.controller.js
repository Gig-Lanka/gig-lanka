import { asyncHandler } from '../utils/asyncHandler.js';
import { sendSuccess } from '../utils/response.js';
import {
  applyToGig as applyToGigService,
  listMyApplications as listMyApplicationsService,
  getApplicationById as getApplicationByIdService,
  withdrawApplication as withdrawApplicationService,
  completeApplication as completeApplicationService,
} from '../services/application.service.js';

export const applyToGig = asyncHandler(async (req, res) => {
  const result = await applyToGigService(req.params.gigId, req.user);

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

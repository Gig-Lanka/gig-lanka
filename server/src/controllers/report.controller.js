import { asyncHandler } from '../utils/asyncHandler.js';
import { sendSuccess } from '../utils/response.js';
import {
  createReport as createReportService,
  listMyReports as listMyReportsService,
  listOpenReports as listOpenReportsService,
  closeReport as closeReportService,
} from '../services/report.service.js';

export const createReport = asyncHandler(async (req, res) => {
  const actor = { id: req.user.id, role: req.user.role };
  const report = await createReportService(actor, req.body);

  sendSuccess(res, { report }, 201);
});

export const getMyReports = asyncHandler(async (req, res) => {
  const result = await listMyReportsService(req.user.id);

  sendSuccess(res, result, 200);
});

// GL-370. The admin gate (requireAuth + requireRole('admin')) is applied at
// the router, not here — this handler has no role check of its own.
export const getOpenReports = asyncHandler(async (req, res) => {
  const result = await listOpenReportsService(req.query);

  sendSuccess(res, result, 200);
});

// GL-442. Same router-level admin gate as the queue. The admin's id comes from
// the token and the new status from which route was hit — neither is ever
// read from the body, which validate() has already cut down to { note }.
export const resolveReport = asyncHandler(async (req, res) => {
  const report = await closeReportService(req.params.id, req.user.id, 'resolved', req.body.note);

  sendSuccess(res, { report }, 200);
});

export const dismissReport = asyncHandler(async (req, res) => {
  const report = await closeReportService(req.params.id, req.user.id, 'dismissed', req.body.note);

  sendSuccess(res, { report }, 200);
});

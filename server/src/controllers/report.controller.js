import { asyncHandler } from '../utils/asyncHandler.js';
import { sendSuccess } from '../utils/response.js';
import {
  createReport as createReportService,
  listMyReports as listMyReportsService,
  listOpenReports as listOpenReportsService,
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

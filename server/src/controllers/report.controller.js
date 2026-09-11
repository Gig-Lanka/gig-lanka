import { asyncHandler } from '../utils/asyncHandler.js';
import { sendSuccess } from '../utils/response.js';
import { createReport as createReportService } from '../services/report.service.js';

export const createReport = asyncHandler(async (req, res) => {
  const actor = { id: req.user.id, role: req.user.role };
  const report = await createReportService(actor, req.body);

  sendSuccess(res, { report }, 201);
});

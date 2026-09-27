import { asyncHandler } from '../utils/asyncHandler.js';
import { sendSuccess } from '../utils/response.js';
import { takedownGig as takedownGigService } from '../services/gig.service.js';

// GL-434. The admin gate (requireAuth + requireRole('admin')) is applied at
// the router, not here — matches report.controller.js's getOpenReports.
export const closeGigAsAdmin = asyncHandler(async (req, res) => {
  const gig = await takedownGigService(req.params.id);

  sendSuccess(res, { gig }, 200);
});

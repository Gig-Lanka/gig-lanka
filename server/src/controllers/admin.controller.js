import { asyncHandler } from '../utils/asyncHandler.js';
import { sendSuccess } from '../utils/response.js';
import { takedownGig as takedownGigService } from '../services/gig.service.js';
import { suspendAccount, reinstateAccount } from '../services/account.service.js';

// GL-434. The admin gate (requireAuth + requireRole('admin')) is applied at
// the router, not here — matches report.controller.js's getOpenReports.
export const closeGigAsAdmin = asyncHandler(async (req, res) => {
  const gig = await takedownGigService(req.params.id);

  sendSuccess(res, { gig }, 200);
});

// GL-428. Same router-level admin gate as the takedown above. The response
// shape is flat, not nested under `user` or `gig` — { userId, status,
// suspendedAt } is the whole payload the story specifies.
export const suspendUser = asyncHandler(async (req, res) => {
  const result = await suspendAccount(req.params.id);

  sendSuccess(res, result, 200);
});

export const reinstateUser = asyncHandler(async (req, res) => {
  const result = await reinstateAccount(req.params.id);

  sendSuccess(res, result, 200);
});

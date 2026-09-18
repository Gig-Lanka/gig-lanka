import { Router } from 'express';
import { createReport, getMyReports } from '../controllers/report.controller.js';
import { validate } from '../middleware/validate.middleware.js';
import { requireAuth, requireRole } from '../middleware/auth.middleware.js';
import { createReportSchema } from '../validators/report.validator.js';

const router = Router();

// Either role may file a report; an admin may not — admins have no profile
// and are not participants in the marketplace. requireRole's allow-list
// keeps that refusal a 403 FORBIDDEN, the same shape every other
// role-gated endpoint uses, rather than a bespoke check in the service.
router.post(
  '/reports',
  requireAuth,
  requireRole('seeker', 'business'),
  validate(createReportSchema),
  createReport,
);

// GL-368. Declared before any /:id-shaped route on this router, so "mine" is
// never swallowed as an id — the same literal-before-parameter guard
// /applications/mine and /applications/for-my-gigs already use. Just
// requireAuth, no requireRole: either role may file a report (§6), so either
// role reads its own back, the same as /reviews/mine. An admin can reach
// this route too, but never has anything to see — they have no path that
// creates a report, so their own list is always empty.
router.get('/reports/mine', requireAuth, getMyReports);

export default router;

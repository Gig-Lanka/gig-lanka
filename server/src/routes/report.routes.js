import { Router } from 'express';
import { createReport } from '../controllers/report.controller.js';
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

export default router;

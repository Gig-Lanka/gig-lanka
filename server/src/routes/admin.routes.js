import { Router } from 'express';
import { getAdminReports, resolveReport, dismissReport } from '../controllers/report.controller.js';
import { requireAuth, requireRole } from '../middleware/auth.middleware.js';
import { validate, validateQuery } from '../middleware/validate.middleware.js';
import { adminReportsQuerySchema, closeReportSchema } from '../validators/report.validator.js';

const router = Router();

// GL-302/GL-370: a dedicated admin prefix rather than folding this into
// /api/reports?status=open. Sprint 4 adds several more admin endpoints
// (resolve, dismiss, suspend, ...), and this gives all of them one obvious
// home and one place — here, at the router — to apply requireRole('admin'),
// instead of repeating the gate per-handler.
router.use(requireAuth, requireRole('admin'));

// GL-443: ?status=open|closed, defaulting to open.
router.get('/reports', validateQuery(adminReportsQuerySchema), getAdminReports);

// GL-442: close a report, once and final. Both take { note }; there is no
// reopen or edit route.
router.patch('/reports/:id/resolve', validate(closeReportSchema), resolveReport);
router.patch('/reports/:id/dismiss', validate(closeReportSchema), dismissReport);

export default router;

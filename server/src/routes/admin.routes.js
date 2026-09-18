import { Router } from 'express';
import { getOpenReports } from '../controllers/report.controller.js';
import { requireAuth, requireRole } from '../middleware/auth.middleware.js';

const router = Router();

// GL-302/GL-370: a dedicated admin prefix rather than folding this into
// /api/reports?status=open. Sprint 4 adds several more admin endpoints
// (resolve, dismiss, suspend, ...), and this gives all of them one obvious
// home and one place — here, at the router — to apply requireRole('admin'),
// instead of repeating the gate per-handler.
router.use(requireAuth, requireRole('admin'));

// Read-only by design. This is the whole route for Sprint 3: no resolve,
// dismiss, suspend, warn or assign verb is mounted here or anywhere else on
// this router — every action on a report is Sprint 4 dispute handling.
router.get('/reports', getOpenReports);

export default router;

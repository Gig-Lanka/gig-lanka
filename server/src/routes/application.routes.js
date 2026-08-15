import { Router } from 'express';
import { applyToGig } from '../controllers/application.controller.js';
import { validate } from '../middleware/validate.middleware.js';
import { requireAuth, requireRole } from '../middleware/auth.middleware.js';
import { applyToGigSchema } from '../validators/application.validator.js';

const router = Router();

// Mounted at /api root, like review.routes.js: applying is addressed under
// the gig it belongs to (docs/api-contract.md §1), so the full path is
// declared here rather than nesting a sub-router under gig.routes.js.
router.post(
  '/gigs/:gigId/applications',
  requireAuth,
  requireRole('seeker'),
  validate(applyToGigSchema),
  applyToGig,
);

export default router;

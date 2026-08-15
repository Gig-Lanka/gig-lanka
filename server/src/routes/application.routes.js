import { Router } from 'express';
import {
  applyToGig,
  getMyApplications,
  getApplication,
} from '../controllers/application.controller.js';
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

// GL-183. /mine is seeker-only — a business doesn't submit applications, it
// receives them. Declared before /:id so "mine" is never swallowed as an id.
router.get('/applications/mine', requireAuth, requireRole('seeker'), getMyApplications);

// Either party (the applicant or the business that posted the gig) may read
// one application; ownership is checked in the service, after existence, so
// a missing id 404s before a wrong party ever sees a 403.
router.get('/applications/:id', requireAuth, getApplication);

export default router;

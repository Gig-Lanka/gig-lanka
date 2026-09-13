import { Router } from 'express';
import {
  applyToGig,
  getMyApplications,
  getApplication,
  withdrawApplication,
  completeApplication,
  getApplicationsForMyGigs,
  viewApplication,
  shortlistApplication,
  hireApplication,
  rejectApplication,
  reviewSkillTrial,
} from '../controllers/application.controller.js';
import { validate } from '../middleware/validate.middleware.js';
import { requireAuth, requireRole } from '../middleware/auth.middleware.js';
import {
  applyToGigSchema,
  rejectApplicationSchema,
  trialReviewSchema,
} from '../validators/application.validator.js';

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

// GL-252. The mirror of /mine for the business side — every application
// across all of the caller's gigs. Also declared before /:id so
// "for-my-gigs" is never swallowed as an id.
router.get(
  '/applications/for-my-gigs',
  requireAuth,
  requireRole('business'),
  getApplicationsForMyGigs,
);

// Either party (the applicant or the business that posted the gig) may read
// one application; ownership is checked in the service, after existence, so
// a missing id 404s before a wrong party ever sees a 403.
router.get('/applications/:id', requireAuth, getApplication);

// GL-184. requireRole('seeker') fails fast on a business token; which
// specific seeker owns the application is then checked inside
// transitionApplicationStatus, the same layering gig.routes.js uses for
// close/delete (role gate at the route, ownership in the service).
router.patch('/applications/:id/withdraw', requireAuth, requireRole('seeker'), withdrawApplication);

// GL-248. The mirror of withdraw, and the same layering: requireRole gates
// the kind of actor, and which specific business owns the gig is checked
// inside transitionApplicationStatus. Business-only — a seeker never marks
// their own work complete, including the applicant themselves. No validate()
// and no body: completion takes no reason.
router.patch(
  '/applications/:id/complete',
  requireAuth,
  requireRole('business'),
  completeApplication,
);

// GL-253. Same layering as withdraw/complete: requireRole gates the kind of
// actor, and which specific business owns the gig is checked inside
// transitionApplicationStatus. No validate() and no body — view, shortlist
// and hire take none.
router.patch('/applications/:id/view', requireAuth, requireRole('business'), viewApplication);
router.patch(
  '/applications/:id/shortlist',
  requireAuth,
  requireRole('business'),
  shortlistApplication,
);
router.patch('/applications/:id/hire', requireAuth, requireRole('business'), hireApplication);

// GL-253. reject takes { reasonCode, note } — validate() only shapes the
// body (strips unknown fields); the four rejection rules themselves live in
// assertValidRejection (application.service.js), not here.
router.patch(
  '/applications/:id/reject',
  requireAuth,
  requireRole('business'),
  validate(rejectApplicationSchema),
  rejectApplication,
);

// GL-352. The review is a result, not a status — separate from
// shortlist/hire/reject above, so it takes no status precondition; a
// business can still shortlist, hire or reject the same application
// afterwards regardless of how the trial was marked. Same layering as the
// rest of this file: requireRole gates the kind of actor, and which
// specific business owns the gig is checked inside reviewSkillTrial.
router.patch(
  '/applications/:id/trial-review',
  requireAuth,
  requireRole('business'),
  validate(trialReviewSchema),
  reviewSkillTrial,
);

export default router;

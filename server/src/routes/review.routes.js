import { Router } from 'express';
import { createReview, getUserReviews } from '../controllers/review.controller.js';
import { validate } from '../middleware/validate.middleware.js';
import { requireAuth } from '../middleware/auth.middleware.js';
import { createReviewSchema } from '../validators/review.validator.js';

const router = Router();

// Mounted at /api root: a review is created against the application it came
// from (/applications/:applicationId/reviews) but read back against the user
// it's about (/users/:userId/reviews) — one component, two resource prefixes,
// so full paths are declared here rather than splitting this file in two.
// Both parties to an application may create a review (seeker or business),
// and any signed-in caller may read one, so both routes only require auth,
// not a role.
router.post('/applications/:applicationId/reviews', requireAuth, validate(createReviewSchema), createReview);
router.get('/users/:userId/reviews', requireAuth, getUserReviews);

export default router;

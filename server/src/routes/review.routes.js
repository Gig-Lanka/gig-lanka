import { Router } from 'express';
import { createReview, getUserReviews, getMyReviews } from '../controllers/review.controller.js';
import { validate } from '../middleware/validate.middleware.js';
import { requireAuth } from '../middleware/auth.middleware.js';
import { createReviewSchema } from '../validators/review.validator.js';

const router = Router();

// Mounted at /api root: a review is created against the application it came
// from (/applications/:applicationId/reviews) but read back against the user
// it's about (/users/:userId/reviews), or against the caller who wrote it
// (/reviews/mine) — one component, three resource prefixes, so full paths
// are declared here rather than splitting this file up. Both parties to an
// application may create a review (seeker or business), and any signed-in
// caller may read one, so all three routes only require auth, not a role.
router.post('/applications/:applicationId/reviews', requireAuth, validate(createReviewSchema), createReview);
router.get('/users/:userId/reviews', requireAuth, getUserReviews);
router.get('/reviews/mine', requireAuth, getMyReviews);

export default router;

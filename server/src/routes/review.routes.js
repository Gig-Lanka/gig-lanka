import { Router } from 'express';
import { createReview } from '../controllers/review.controller.js';
import { validate } from '../middleware/validate.middleware.js';
import { requireAuth } from '../middleware/auth.middleware.js';
import { createReviewSchema } from '../validators/review.validator.js';

const router = Router();

// Mounted at /api/applications — both parties to an application may create
// a review (seeker or business), so this only requires auth, not a role.
router.post('/:applicationId/reviews', requireAuth, validate(createReviewSchema), createReview);

export default router;

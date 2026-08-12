import { Router } from 'express';
import { createGig, listGigs, getGig } from '../controllers/gig.controller.js';
import { validate } from '../middleware/validate.middleware.js';
import { requireAuth, requireRole } from '../middleware/auth.middleware.js';
import { createGigSchema } from '../validators/gig.validator.js';

const router = Router();

router.post('/', requireAuth, requireRole('business'), validate(createGigSchema), createGig);
router.get('/', listGigs);
router.get('/:id', getGig);

export default router;

import { Router } from 'express';
import {
  createGig,
  listGigs,
  getGig,
  getMyGigs,
  updateGig,
  closeGig,
  deleteGig,
} from '../controllers/gig.controller.js';
import { validate, validateQuery } from '../middleware/validate.middleware.js';
import { requireAuth, requireRole, optionalAuth } from '../middleware/auth.middleware.js';
import { createGigSchema, updateGigSchema, listGigsQuerySchema } from '../validators/gig.validator.js';

const router = Router();

router.post('/', requireAuth, requireRole('business'), validate(createGigSchema), createGig);
router.get('/', validateQuery(listGigsQuerySchema), listGigs);
router.get('/mine', requireAuth, requireRole('business'), getMyGigs);
router.get('/:id', optionalAuth, getGig);
router.put('/:id', requireAuth, requireRole('business'), validate(updateGigSchema), updateGig);
router.patch('/:id/close', requireAuth, requireRole('business'), closeGig);
router.delete('/:id', requireAuth, requireRole('business'), deleteGig);

export default router;

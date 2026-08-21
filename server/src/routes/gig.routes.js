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
import { getGigApplications } from '../controllers/application.controller.js';
import { validate } from '../middleware/validate.middleware.js';
import { requireAuth, requireRole } from '../middleware/auth.middleware.js';
import { createGigSchema, updateGigSchema } from '../validators/gig.validator.js';

const router = Router();

router.post('/', requireAuth, requireRole('business'), validate(createGigSchema), createGig);
router.get('/', listGigs);
router.get('/mine', requireAuth, requireRole('business'), getMyGigs);
router.get('/:id', getGig);
router.put('/:id', requireAuth, requireRole('business'), validate(updateGigSchema), updateGig);
router.patch('/:id/close', requireAuth, requireRole('business'), closeGig);
router.delete('/:id', requireAuth, requireRole('business'), deleteGig);

// GL-252. Nested here rather than under application.routes.js — unlike the
// POST that creates an application, this list belongs to a specific gig, so
// gig.service.js's findOwnedGig (existence before ownership) is a direct fit.
router.get('/:gigId/applications', requireAuth, requireRole('business'), getGigApplications);

export default router;

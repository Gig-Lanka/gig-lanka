import { Router } from 'express';
import {
  createGig,
  listGigs,
  getGig,
  getMyGigs,
  updateGig,
  closeGig,
  deleteGig,
  saveGig,
  unsaveGig,
  getSavedGigs,
} from '../controllers/gig.controller.js';
import { getGigApplications } from '../controllers/application.controller.js';
import { validate, validateQuery } from '../middleware/validate.middleware.js';
import { requireAuth, requireRole, optionalAuth } from '../middleware/auth.middleware.js';
import { createGigSchema, updateGigSchema, listGigsQuerySchema } from '../validators/gig.validator.js';

const router = Router();

router.post('/', requireAuth, requireRole('business'), validate(createGigSchema), createGig);
router.get('/', validateQuery(listGigsQuerySchema), listGigs);
router.get('/mine', requireAuth, requireRole('business'), getMyGigs);
// GL-332. Declared before /:id for the same reason /mine above and
// /applications/for-my-gigs in application.routes.js are: a literal
// segment placed after a `/:id` route gets swallowed as an id instead of
// matching, and this project has hit that trap before.
router.get('/saved', requireAuth, requireRole('seeker'), getSavedGigs);
router.get('/:id', optionalAuth, getGig);
router.put('/:id', requireAuth, requireRole('business'), validate(updateGigSchema), updateGig);
router.patch('/:id/close', requireAuth, requireRole('business'), closeGig);
router.delete('/:id', requireAuth, requireRole('business'), deleteGig);

// GL-331. Sub-path PUT/DELETE rather than a PATCH .../save toggle: a toggle's
// result depends on prior state, which is exactly what breaks under the
// client's optimistic double-tap. Neither reads req.body — no validate()
// here, matching close/delete above.
router.put('/:id/save', requireAuth, requireRole('seeker'), saveGig);
router.delete('/:id/save', requireAuth, requireRole('seeker'), unsaveGig);

// GL-252. Nested here rather than under application.routes.js — unlike the
// POST that creates an application, this list belongs to a specific gig, so
// gig.service.js's findOwnedGig (existence before ownership) is a direct fit.
router.get('/:gigId/applications', requireAuth, requireRole('business'), getGigApplications);

export default router;

import { Router } from 'express';
import { getMyProfile } from '../controllers/profile.controller.js';
import { requireAuth, requireRole } from '../middleware/auth.middleware.js';

const router = Router();

// Admins have no profile (criterion 7). requireRole fails closed and reads the
// role off the user requireAuth loaded from the database, not off the token.
router.get('/me', requireAuth, requireRole('seeker', 'business'), getMyProfile);

export default router;

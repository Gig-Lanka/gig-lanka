import { Router } from 'express';
import {
  getMyProfile,
  updateMyProfile,
  getPublicProfile,
} from '../controllers/profile.controller.js';
import { validate } from '../middleware/validate.middleware.js';
import { requireAuth, requireRole } from '../middleware/auth.middleware.js';
import { updateProfileSchema } from '../validators/profile.validator.js';
import { ApiError } from '../utils/ApiError.js';

const router = Router();

// Admins have no profile (criterion 7). requireRole fails closed and reads the
// role off the user requireAuth loaded from the database, not off the token.
const requireProfileRole = requireRole('seeker', 'business');

router.get('/me', requireAuth, requireProfileRole, getMyProfile);
router.put('/me', requireAuth, requireProfileRole, validate(updateProfileSchema), updateMyProfile);

// Registered after '/me' so the literal path wins over the parameter.
router.get('/:userId', requireAuth, requireProfileRole, getPublicProfile);

// editing anyone but yourself is impossible by design
router.put('/:userId', requireAuth, () => {
  throw new ApiError(403, 'FORBIDDEN', 'You can only update your own profile.');
});

export default router;

import { Router } from 'express';
import {
  register,
  login,
  refresh,
  logout,
  me,
  changePassword,
} from '../controllers/auth.controller.js';
import { validate } from '../middleware/validate.middleware.js';
import { requireAuth, requireRole } from '../middleware/auth.middleware.js';
import { sendSuccess } from '../utils/response.js';
import {
  registerSchema,
  loginSchema,
  refreshSchema,
  logoutSchema,
  changePasswordSchema,
} from '../validators/auth.validator.js';

const router = Router();

router.post('/register', validate(registerSchema), register);
router.post('/login', validate(loginSchema), login);
router.post('/refresh', validate(refreshSchema), refresh);
router.post('/logout', validate(logoutSchema), requireAuth, logout);
router.get('/me', requireAuth, me);
router.post('/change-password', validate(changePasswordSchema), requireAuth, changePassword);

// Temporary smoke-test route for GL-60 — proves requireRole works end to end
// (seeker token -> 403, admin token -> 200). Remove once GL-17 covers this with tests.
router.get('/admin-smoke-test', requireAuth, requireRole('admin'), (req, res) => {
  sendSuccess(res, { message: 'You are authenticated as an admin.' });
});

export default router;

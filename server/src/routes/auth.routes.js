import { Router } from 'express';
import {
  register,
  login,
  refresh,
  logout,
  me,
  changePassword,
  forgotPassword,
  deactivate,
} from '../controllers/auth.controller.js';
import { validate } from '../middleware/validate.middleware.js';
import { requireAuth } from '../middleware/auth.middleware.js';
import {
  registerSchema,
  loginSchema,
  refreshSchema,
  logoutSchema,
  changePasswordSchema,
  forgotPasswordSchema,
} from '../validators/auth.validator.js';

const router = Router();

router.post('/register', validate(registerSchema), register);
router.post('/login', validate(loginSchema), login);
router.post('/refresh', validate(refreshSchema), refresh);
router.post('/logout', validate(logoutSchema), requireAuth, logout);
router.get('/me', requireAuth, me);
router.post('/change-password', validate(changePasswordSchema), requireAuth, changePassword);
router.post('/forgot-password', validate(forgotPasswordSchema), forgotPassword);
router.post('/deactivate', requireAuth, deactivate);

export default router;

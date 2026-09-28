import { Router } from 'express';
import { getResetLinkPage } from '../controllers/resetLink.controller.js';

const router = Router();

router.get('/', getResetLinkPage);

export default router;

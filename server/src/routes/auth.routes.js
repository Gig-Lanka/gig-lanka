import { Router } from "express";
import { register, login, refresh } from "../controllers/auth.controller.js";
import { validate } from "../middleware/validate.middleware.js";
import { registerSchema, loginSchema, refreshSchema } from "../validators/auth.validator.js";

const router = Router();

router.post("/register", validate(registerSchema), register);
router.post("/login", validate(loginSchema), login);
router.post("/refresh", validate(refreshSchema), refresh);

export default router;

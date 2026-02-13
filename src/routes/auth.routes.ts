import { Router } from 'express';
import authController from '@/controllers/auth.controller';
import { authenticate } from '@/middlewares/auth.middleware';
import { validateRequest } from '@/middlewares/validation.middleware';
import { authLimiter } from '@/middlewares/rate-limit.middleware';
import { registerSchema, loginSchema } from '@/utils/validators';

const router = Router();

router.post('/register', authLimiter, validateRequest(registerSchema), authController.register);
router.post('/login', authLimiter, validateRequest(loginSchema), authController.login);
router.post('/refresh-token', authController.refreshToken);

// Rutas protegidas
router.use(authenticate);
router.get('/me', authController.getMe);
router.put('/profile', authController.updateProfile);
router.post('/change-password', authController.changePassword);

export default router;
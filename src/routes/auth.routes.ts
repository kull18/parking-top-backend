import { Router } from 'express';
import authController from '@/controllers/auth.controller';
import { authenticate } from '@/middlewares/auth.middleware';
import { authorize } from '@/middlewares/role.middleware';
import { validateRequest } from '@/middlewares/validation.middleware';
import { authLimiter } from '@/middlewares/rate-limit.middleware';
import { upload, handleUploadError } from '@/middlewares/upload.middleware';
import { UserRole } from '@/types/enums';
import { registerSchema, loginSchema } from '@/utils/validators';

const router = Router();

router.post(
  '/register',
  authLimiter,
  upload.single('profileImage'),
  handleUploadError,
  validateRequest(registerSchema),
  authController.register
);

router.post('/login', authLimiter, validateRequest(loginSchema), authController.login);
router.post('/refresh-token', authController.refreshToken);

router.use(authenticate);

router.get('/me', authController.getMe);

router.get(
  '/owner/subscription-status',
  authController.getOwnerSubscriptionStatus
);


router.put(
  '/profile',
  upload.single('profileImage'),
  handleUploadError,
  authController.updateProfile
);

router.post('/change-password', authController.changePassword);

export default router;
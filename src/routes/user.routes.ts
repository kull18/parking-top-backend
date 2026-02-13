import { Router } from 'express';
import userController from '@/controllers/user.controller';
import { authenticate } from '@/middlewares/auth.middleware';
import { upload, handleUploadError } from '@/middlewares/upload.middleware';

const router = Router();

// Todas las rutas requieren autenticación
router.use(authenticate);

// Perfil
router.get('/profile', userController.getProfile);
router.put('/profile', userController.updateProfile);
router.post(
  '/profile/image',
  upload.single('image'),
  handleUploadError,
  userController.uploadProfileImage
);

// Vehículos
router.get('/vehicles', userController.getVehicles);
router.post('/vehicles', userController.addVehicle);
router.put('/vehicles/:id', userController.updateVehicle);
router.delete('/vehicles/:id', userController.deleteVehicle);

// Notificaciones
router.get('/notifications', userController.getNotifications);
router.put('/notifications/:id/read', userController.markNotificationAsRead);
router.put('/notifications/read-all', userController.markAllNotificationsAsRead);

export default router;
// src/routes/notification.routes.ts
import { Router } from 'express';
import notificationController from '@/controllers/notification.controller';
import { authenticate } from '@/middlewares/auth.middleware';
import { validateRequest } from '@/middlewares/validation.middleware';
import { registerFCMTokenSchema, removeFCMTokenSchema } from '@/utils/validators';

const router = Router();

// Todas las rutas requieren autenticación
router.use(authenticate);

/**
 * GET /notifications
 * Obtener mis notificaciones
 */
router.get('/', notificationController.getMyNotifications);

/**
 * GET /notifications/unread-count
 * Obtener contador de no leídas
 */
router.get('/unread-count', notificationController.getUnreadCount);

/**
 * PUT /notifications/:id/read
 * Marcar notificación como leída
 */
router.put('/:id/read', notificationController.markAsRead);

/**
 * PUT /notifications/read-all
 * Marcar todas como leídas
 */
router.put('/read-all', notificationController.markAllAsRead);

/**
 * POST /notifications/fcm-token
 * Registrar token FCM
 */
router.post(
  '/fcm-token',
  validateRequest(registerFCMTokenSchema),
  notificationController.registerFCMToken
);

/**
 * DELETE /notifications/fcm-token
 * Eliminar token FCM
 */
router.delete(
  '/fcm-token',
  validateRequest(removeFCMTokenSchema),
  notificationController.removeFCMToken
);

export default router;
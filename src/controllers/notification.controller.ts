// src/controllers/notification.controller.ts
import { Response, NextFunction } from 'express';
import { AuthRequest } from '@/types/interfaces';
import notificationService from '@/services/notification.service';
import { sendSuccess, sendError } from '@/utils/response';
import logger from '@/utils/logger';

export class NotificationController {

  /**
   * Obtener notificaciones del usuario
   * GET /notifications
   */
  async getMyNotifications(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const { page = 1, perPage = 20, isRead } = req.query;

      const result = await notificationService.getUserNotifications(
        userId,
        Number(page),
        Number(perPage),
        isRead === 'true' ? true : isRead === 'false' ? false : undefined
      );

      sendSuccess(res, result.notifications, 200, result.pagination);
    } catch (error) {
      logger.error('Error getting notifications:', error);
      next(error);
    }
  }

  /**
   * Marcar notificación como leída
   * PUT /notifications/:id/read
   */
  async markAsRead(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const { id } = req.params;

      const notification = await notificationService.markAsRead(id, userId);

      sendSuccess(res, notification);
    } catch (error: any) {
      logger.error('Error marking notification as read:', error);
      
      if (error.message === 'Notificación no encontrada') {
        sendError(res, 'NOT_FOUND', error.message, 404);
      } else if (error.message.includes('permiso')) {
        sendError(res, 'FORBIDDEN', error.message, 403);
      } else {
        next(error);
      }
    }
  }

  /**
   * Marcar todas como leídas
   * PUT /notifications/read-all
   */
  async markAllAsRead(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;

      const count = await notificationService.markAllAsRead(userId);

      sendSuccess(res, { count, message: `${count} notificaciones marcadas como leídas` });
    } catch (error) {
      logger.error('Error marking all as read:', error);
      next(error);
    }
  }

  /**
   * Registrar token FCM
   * POST /notifications/fcm-token
   */
  async registerFCMToken(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const { token, platform } = req.body;

      const pushToken = await notificationService.registerPushToken(
        userId,
        token,
        platform
      );

      sendSuccess(res, pushToken, 201);
    } catch (error) {
      logger.error('Error registering FCM token:', error);
      next(error);
    }
  }

  /**
   * Eliminar token FCM
   * DELETE /notifications/fcm-token
   */
  async removeFCMToken(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { token } = req.body;

      await notificationService.removePushToken(token);

      sendSuccess(res, { message: 'Token eliminado correctamente' });
    } catch (error: any) {
      logger.error('Error removing FCM token:', error);
      
      if (error.message === 'Token no encontrado') {
        sendError(res, 'NOT_FOUND', error.message, 404);
      } else {
        next(error);
      }
    }
  }

  /**
   * Obtener contador de no leídas
   * GET /notifications/unread-count
   */
  async getUnreadCount(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;

      const count = await notificationService.getUnreadCount(userId);

      sendSuccess(res, { count });
    } catch (error) {
      logger.error('Error getting unread count:', error);
      next(error);
    }
  }
}

export default new NotificationController();
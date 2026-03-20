// src/services/notification.service.ts
import notificationRepository from '@/repositories/notification.repository';
import pushTokenRepository from '@/repositories/push-token.repository';
import firebaseService from '@/integrations/firebase.client';
import { NotificationType } from '@/types/enums';
import logger from '@/utils/logger';

export class NotificationService {

  /**
   * Obtener notificaciones del usuario
   */
  async getUserNotifications(
    userId: string,
    page: number = 1,
    perPage: number = 20,
    isRead?: boolean
  ) {
    const skip = (page - 1) * perPage;
    const [notifications, total] = await notificationRepository.findByUser(
      userId,
      skip,
      perPage,
      isRead
    );

    return {
      notifications,
      pagination: {
        page,
        perPage,
        total,
        totalPages: Math.ceil(total / perPage)
      }
    };
  }

  /**
   * Marcar notificación como leída
   */
  async markAsRead(id: string, userId: string) {
    const notification = await notificationRepository.findById(id);

    if (!notification) {
      throw new Error('Notificación no encontrada');
    }

    if (notification.userId !== userId) {
      throw new Error('No tienes permiso para acceder a esta notificación');
    }

    return await notificationRepository.markAsRead(id);
  }

  /**
   * Marcar todas como leídas
   */
  async markAllAsRead(userId: string): Promise<number> {
    return await notificationRepository.markAllAsRead(userId);
  }

  /**
   * Obtener contador de no leídas
   */
  async getUnreadCount(userId: string): Promise<number> {
    return await notificationRepository.countUnread(userId);
  }

  /**
   * Crear y enviar notificación
   */
  async createAndSend(data: {
    userId: string;
    type: NotificationType;
    title: string;
    message: string;
    reservationId?: string;
    data?: Record<string, string>;
  }) {
    // Crear notificación en BD
    const notification = await notificationRepository.create({
      userId: data.userId,
      type: data.type,
      title: data.title,
      message: data.message,
      reservationId: data.reservationId
    });

    // Enviar push notification
    await firebaseService.sendToUser(data.userId, {
      title: data.title,
      body: data.message,
      data: {
        notificationId: notification.id,
        type: data.type,
        ...(data.data || {})
      }
    });

    logger.info(`Notification created and sent: ${notification.id} to user ${data.userId}`);

    return notification;
  }

  /**
   * Registrar token de push
   */
  async registerPushToken(
    userId: string,
    token: string,
    platform: 'android' | 'ios' | 'web'
  ) {
    // Verificar si ya existe el token exacto
    const existingToken = await pushTokenRepository.findByToken(token);

    if (existingToken) {
      // Si existe pero está inactivo, reactivarlo
      if (!existingToken.isActive) {
        return await pushTokenRepository.update(existingToken.id, { isActive: true });
      }
      // Si ya existe y está activo, retornarlo
      return existingToken;
    }

    // Buscar si hay un token existente del mismo usuario y plataforma
    const existingPlatformToken = await pushTokenRepository.findByUserAndPlatform(userId, platform);

    if (existingPlatformToken) {
      // Actualizar el token existente
      return await pushTokenRepository.update(existingPlatformToken.id, { token, isActive: true });
    }

    // Crear nuevo token
    return await pushTokenRepository.create({
      userId,
      token,
      platform
    });
  }

  /**
   * Remover token de push
   */
  async removePushToken(token: string) {
    const pushToken = await pushTokenRepository.findByToken(token);

    if (!pushToken) {
      throw new Error('Token no encontrado');
    }

    await pushTokenRepository.deactivate(pushToken.id);

    logger.info(`Push token deactivated: ${token}`);
  }

  /**
   * Enviar notificación masiva (admin)
   */
  async sendBulkNotification(
    userIds: string[],
    notification: {
      title: string;
      body: string;
      data?: Record<string, string>;
    }
  ) {
    for (const userId of userIds) {
      await this.createAndSend({
        userId,
        type: NotificationType.GENERAL,
        title: notification.title,
        message: notification.body,
        data: notification.data
      });
    }

    logger.info(`Bulk notification sent to ${userIds.length} users`);
  }
}

export default new NotificationService();
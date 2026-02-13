import notificationRepository from '@/repositories/notification.repository';
import { NotificationType } from '@/types/enums';
import firebaseService from '@/integrations/firebase.client';
import logger from '@/utils/logger';

export class NotificationService {
  
  /**
   * Crear notificación y enviar push notification
   */
  async create(data: {
    userId: string;
    type: NotificationType;
    title: string;
    message: string;
    reservationId?: string;
    subscriptionId?: string;
    data?: any;
  }) {
    try {
      // Crear notificación en DB
      const notification = await notificationRepository.create({
        userId: data.userId,
        type: data.type,
        title: data.title,
        message: data.message,
        reservationId: data.reservationId,
        subscriptionId: data.subscriptionId,
        data: data.data,
        isRead: false,
        isSent: false
      });

      // Enviar push notification vía Firebase
      try {
        await firebaseService.sendToUser(data.userId, {
          title: data.title,
          body: data.message,
          data: {
            notificationId: notification.id,
            type: data.type,
            ...(data.reservationId && { reservationId: data.reservationId }),
            ...(data.subscriptionId && { subscriptionId: data.subscriptionId })
          }
        });

        // Marcar como enviada
        await notificationRepository.update(notification.id, {
          isSent: true,
          sentAt: new Date()
        });
      } catch (pushError) {
        logger.warn('Failed to send push notification, but notification saved in DB:', pushError);
        // No lanzar error, la notificación se guardó en DB
      }

      return notification;
    } catch (error) {
      logger.error('Error creating notification:', error);
      throw error;
    }
  }

  /**
   * Crear múltiples notificaciones (sin push)
   */
  async bulkCreate(notifications: Array<{
    userId: string;
    type: NotificationType;
    title: string;
    message: string;
    reservationId?: string;
    subscriptionId?: string;
  }>) {
    try {
      return await notificationRepository.bulkCreate(notifications);
    } catch (error) {
      logger.error('Error bulk creating notifications:', error);
      throw error;
    }
  }

  /**
   * Obtener notificaciones de un usuario
   */
  async getUserNotifications(userId: string, unreadOnly: boolean = false, limit?: number) {
    try {
      return await notificationRepository.findByUserId(userId, {
        unreadOnly,
        limit
      });
    } catch (error) {
      logger.error('Error getting user notifications:', error);
      throw error;
    }
  }

  /**
   * Marcar notificación como leída
   */
  async markAsRead(notificationId: string, userId: string) {
    try {
      const notification = await notificationRepository.findById(notificationId);

      if (!notification) {
        throw new Error('Notificación no encontrada');
      }

      if (notification.userId !== userId) {
        throw new Error('No tienes permiso para marcar esta notificación');
      }

      return await notificationRepository.markAsRead(notificationId);
    } catch (error) {
      logger.error('Error marking notification as read:', error);
      throw error;
    }
  }

  /**
   * Marcar todas las notificaciones como leídas
   */
  async markAllAsRead(userId: string) {
    try {
      return await notificationRepository.markAllAsRead(userId);
    } catch (error) {
      logger.error('Error marking all notifications as read:', error);
      throw error;
    }
  }

  /**
   * Obtener contador de notificaciones no leídas
   */
  async getUnreadCount(userId: string) {
    try {
      return await notificationRepository.countUnread(userId);
    } catch (error) {
      logger.error('Error getting unread count:', error);
      throw error;
    }
  }

  /**
   * Obtener notificación por ID
   */
  async getById(notificationId: string, userId: string) {
    try {
      const notification = await notificationRepository.findById(notificationId);

      if (!notification) {
        throw new Error('Notificación no encontrada');
      }

      if (notification.userId !== userId) {
        throw new Error('No tienes permiso para ver esta notificación');
      }

      return notification;
    } catch (error) {
      logger.error('Error getting notification by id:', error);
      throw error;
    }
  }

  /**
   * Obtener notificaciones por tipo
   */
  async getByType(userId: string, type: NotificationType) {
    try {
      return await notificationRepository.findByType(userId, type);
    } catch (error) {
      logger.error('Error getting notifications by type:', error);
      throw error;
    }
  }

  /**
   * Obtener notificaciones de una reserva
   */
  async getByReservationId(reservationId: string) {
    try {
      return await notificationRepository.findByReservationId(reservationId);
    } catch (error) {
      logger.error('Error getting notifications by reservation:', error);
      throw error;
    }
  }

  /**
   * Obtener notificaciones de una suscripción
   */
  async getBySubscriptionId(subscriptionId: string) {
    try {
      return await notificationRepository.findBySubscriptionId(subscriptionId);
    } catch (error) {
      logger.error('Error getting notifications by subscription:', error);
      throw error;
    }
  }

  /**
   * Reenviar notificaciones pendientes (para cron job)
   */
  async retryPendingNotifications() {
    try {
      const pendingNotifications = await notificationRepository.findPendingToSend();

      let successCount = 0;
      let failCount = 0;

      for (const notification of pendingNotifications) {
        try {
          await firebaseService.sendToUser(notification.userId, {
            title: notification.title,
            body: notification.message,
            data: {
              notificationId: notification.id,
              type: notification.type
            }
          });

          await notificationRepository.update(notification.id, {
            isSent: true,
            sentAt: new Date()
          });

          successCount++;
        } catch (error) {
          logger.warn(`Failed to resend notification ${notification.id}:`, error);
          failCount++;
        }
      }

      logger.info(`Retry notifications completed: ${successCount} sent, ${failCount} failed`);

      return { successCount, failCount };
    } catch (error) {
      logger.error('Error retrying pending notifications:', error);
      throw error;
    }
  }

  /**
   * Limpiar notificaciones antiguas (para cron job)
   */
  async cleanupOldNotifications(daysOld: number = 180) {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysOld);

      const result = await notificationRepository.deleteOldNotifications(cutoffDate);

      logger.info(`Cleaned up ${result.count} old notifications`);

      return result;
    } catch (error) {
      logger.error('Error cleaning up old notifications:', error);
      throw error;
    }
  }

  /**
   * Enviar notificación de bienvenida
   */
  async sendWelcomeNotification(userId: string, fullName: string) {
    return await this.create({
      userId,
      type: NotificationType.GENERAL,
      title: '¡Bienvenido a Parking Top!',
      message: `Hola ${fullName}, gracias por unirte a nuestra plataforma de estacionamientos.`
    });
  }

  /**
   * Enviar notificación de reserva confirmada
   */
  async sendReservationConfirmed(userId: string, reservationId: string, parkingName: string, reservationCode: string) {
    return await this.create({
      userId,
      type: NotificationType.RESERVATION_CONFIRMED,
      title: 'Reserva confirmada',
      message: `Tu reserva en ${parkingName} ha sido confirmada. Código: ${reservationCode}`,
      reservationId
    });
  }

  /**
   * Enviar recordatorio de reserva próxima
   */
  async sendReservationReminder(userId: string, reservationId: string, parkingName: string, minutesUntil: number) {
    return await this.create({
      userId,
      type: NotificationType.RESERVATION_REMINDER,
      title: 'Tu reserva inicia pronto',
      message: `Tu reserva en ${parkingName} inicia en ${minutesUntil} minutos`,
      reservationId
    });
  }

  /**
   * Enviar advertencia de overtime
   */
  async sendOvertimeWarning(userId: string, reservationId: string, minutesUntilEnd: number) {
    return await this.create({
      userId,
      type: NotificationType.OVERTIME_WARNING,
      title: 'Tu reserva termina pronto',
      message: `Tu tiempo de estacionamiento termina en ${minutesUntilEnd} minutos. Recuerda hacer check-out a tiempo.`,
      reservationId
    });
  }

  /**
   * Enviar notificación de cargo por overtime
   */
  async sendOvertimeCharged(userId: string, reservationId: string, amount: number, hours: number) {
    return await this.create({
      userId,
      type: NotificationType.OVERTIME_CHARGED,
      title: 'Cargo por tiempo extra',
      message: `Se ha cobrado $${amount} MXN por ${hours.toFixed(2)} horas de tiempo extra`,
      reservationId
    });
  }

  /**
   * Enviar notificación de pago recibido
   */
  async sendPaymentReceived(userId: string, amount: number, reservationId?: string) {
    return await this.create({
      userId,
      type: NotificationType.PAYMENT_RECEIVED,
      title: 'Pago recibido',
      message: `Hemos recibido tu pago de $${amount} MXN`,
      reservationId
    });
  }

  /**
   * Enviar notificación de suscripción por vencer
   */
  async sendSubscriptionExpiring(userId: string, subscriptionId: string, planName: string, daysRemaining: number) {
    return await this.create({
      userId,
      type: NotificationType.SUBSCRIPTION_EXPIRING,
      title: 'Tu suscripción se renueva pronto',
      message: `Tu plan ${planName} se renovará en ${daysRemaining} días`,
      subscriptionId
    });
  }

  /**
   * Enviar notificación de suscripción expirada
   */
  async sendSubscriptionExpired(userId: string, subscriptionId: string) {
    return await this.create({
      userId,
      type: NotificationType.SUBSCRIPTION_EXPIRED,
      title: 'Suscripción expirada',
      message: 'Tu suscripción ha expirado. Actualiza tu método de pago para reactivarla.',
      subscriptionId
    });
  }

  /**
   * Enviar notificación de pago fallido
   */
  async sendPaymentFailed(userId: string, subscriptionId: string) {
    return await this.create({
      userId,
      type: NotificationType.PAYMENT_FAILED,
      title: 'Problema con tu pago',
      message: 'No pudimos procesar tu pago. Por favor actualiza tu método de pago.',
      subscriptionId
    });
  }

  /**
   * Enviar notificación de estacionamiento aprobado
   */
  async sendParkingApproved(userId: string, parkingName: string) {
    return await this.create({
      userId,
      type: NotificationType.PARKING_APPROVED,
      title: 'Estacionamiento aprobado',
      message: `Tu estacionamiento "${parkingName}" ha sido aprobado y ya es visible en la plataforma.`
    });
  }
}

export default new NotificationService();
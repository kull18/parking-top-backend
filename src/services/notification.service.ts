import notificationRepository from '@/repositories/notification.repository';
import firebaseService from '@/integrations/firebase.client';
import { NotificationType } from '@/types/enums';
import logger from '@/utils/logger';

export class NotificationService {

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
      const notification = await notificationRepository.create(data);

      // Intentar enviar push notification
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

        await notificationRepository.update(notification.id, {
          isSent: true,
          sentAt: new Date()
        });
      } catch (pushError) {
        logger.error('Error sending push notification:', pushError);
      }

      return notification;
    } catch (error) {
      logger.error('Error creating notification:', error);
      throw error;
    }
  }

  /**
   * Obtener notificaciones del usuario
   */
  async getUserNotifications(userId: string, unreadOnly: boolean = false) {
    const notifications = await notificationRepository.findByUserId(
      userId,
      { unreadOnly }
    );
    const unreadCount = await notificationRepository.countUnread(userId);

    return {
      notifications,
      unreadCount
    };
  }

  /**
   * Marcar notificación como leída
   */
  async markAsRead(userId: string, notificationId: string) {
    const notification = await notificationRepository.findById(notificationId);

    if (!notification || notification.userId !== userId) {
      throw new Error('NOTIFICATION_NOT_FOUND');
    }

    await notificationRepository.markAsRead(notificationId);

    logger.info(`Notification marked as read: ${notificationId}`);
  }

  /**
   * Marcar todas las notificaciones como leídas
   */
  async markAllAsRead(userId: string) {
    await notificationRepository.markAllAsRead(userId);

    logger.info(`All notifications marked as read for user: ${userId}`);
  }

  // ========== HELPERS PARA NOTIFICACIONES COMUNES ==========

  async sendWelcomeNotification(userId: string) {
    return await this.create({
      userId,
      type: NotificationType.GENERAL,
      title: '¡Bienvenido a Parking Top!',
      message: 'Gracias por registrarte. Estamos aquí para ayudarte a encontrar el estacionamiento perfecto.'
    });
  }

  async sendReservationConfirmed(userId: string, reservationId: string, parkingName: string) {
    return await this.create({
      userId,
      type: NotificationType.RESERVATION_CONFIRMED,
      title: 'Reserva confirmada',
      message: `Tu reserva en ${parkingName} ha sido confirmada exitosamente.`,
      reservationId
    });
  }

  async sendReservationReminder(userId: string, reservationId: string, parkingName: string, minutesUntil: number) {
    return await this.create({
      userId,
      type: NotificationType.RESERVATION_REMINDER,
      title: 'Recordatorio de reserva',
      message: `Tu reserva en ${parkingName} comienza en ${minutesUntil} minutos.`,
      reservationId
    });
  }

  async sendOvertimeWarning(userId: string, reservationId: string, overtimeMinutes: number) {
    return await this.create({
      userId,
      type: NotificationType.OVERTIME_WARNING,
      title: 'Tiempo extra detectado',
      message: `Has excedido tu tiempo de reserva por ${overtimeMinutes} minutos. Se aplicarán cargos adicionales.`,
      reservationId
    });
  }

  async sendOvertimeCharged(userId: string, reservationId: string, amount: number, hours: number) {
    return await this.create({
      userId,
      type: NotificationType.OVERTIME_CHARGED,
      title: 'Cargo por tiempo extra',
      message: `Se ha cobrado $${amount} MXN por ${hours.toFixed(1)} horas de tiempo extra.`,
      reservationId
    });
  }

  async sendPaymentReceived(userId: string, amount: number, reservationId?: string) {
    return await this.create({
      userId,
      type: NotificationType.PAYMENT_RECEIVED,
      title: 'Pago recibido',
      message: `Hemos recibido tu pago de $${amount} MXN.`,
      reservationId
    });
  }

  async sendSubscriptionExpiring(userId: string, subscriptionId: string, daysLeft: number) {
    return await this.create({
      userId,
      type: NotificationType.SUBSCRIPTION_EXPIRING,
      title: 'Suscripción por vencer',
      message: `Tu suscripción vence en ${daysLeft} días. Renueva para seguir disfrutando de todos los beneficios.`,
      subscriptionId
    });
  }

  async sendSubscriptionExpired(userId: string, subscriptionId: string) {
    return await this.create({
      userId,
      type: NotificationType.SUBSCRIPTION_EXPIRED,
      title: 'Suscripción vencida',
      message: 'Tu suscripción ha vencido. Renueva para seguir usando el servicio.',
      subscriptionId
    });
  }

  async sendPaymentFailed(userId: string, subscriptionId: string) {
    return await this.create({
      userId,
      type: NotificationType.PAYMENT_FAILED,
      title: 'Error en el pago',
      message: 'No pudimos procesar tu pago. Por favor actualiza tu método de pago.',
      subscriptionId
    });
  }

  async sendParkingApproved(userId: string, parkingName: string) {
    return await this.create({
      userId,
      type: NotificationType.PARKING_APPROVED,
      title: 'Estacionamiento aprobado',
      message: `Tu estacionamiento "${parkingName}" ha sido aprobado y está activo.`
    });
  }

  // ========== CRON JOBS ==========

  async retryPendingNotifications() {
    try {
      const pending = await notificationRepository.findPendingToSend();

      let successCount = 0;

      for (const notification of pending) {
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
          logger.error(`Failed to retry notification ${notification.id}:`, error);
        }
      }

      logger.info(`Retried ${successCount}/${pending.length} pending notifications`);

      return { total: pending.length, success: successCount };
    } catch (error) {
      logger.error('Error retrying pending notifications:', error);
      throw error;
    }
  }

  async cleanupOldNotifications() {
    try {
      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

      const deleted = await notificationRepository.deleteOldNotifications(sixMonthsAgo);

      logger.info(`Cleaned up ${deleted} old notifications`);

      return { deleted };
    } catch (error) {
      logger.error('Error cleaning up notifications:', error);
      throw error;
    }
  }
}

export default new NotificationService();
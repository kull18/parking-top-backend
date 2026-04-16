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
   * Crear notificación simple (sin enviar push automáticamente)
   */
  async create(data: {
    userId: string;
    type: string;
    title: string;
    message: string;
    reservationId?: string;
    subscriptionId?: string;
    data?: any;
  }) {
    return await notificationRepository.create(data);
  }

  /**
   * Crear y enviar notificación con push
   */
  async createAndSend(data: {
    userId: string;
    type: NotificationType;
    title: string;
    message: string;
    reservationId?: string;
    subscriptionId?: string;
    data?: Record<string, string>;
  }) {
    // Crear notificación en BD
    const notification = await notificationRepository.create({
      userId: data.userId,
      type: data.type,
      title: data.title,
      message: data.message,
      reservationId: data.reservationId,
      subscriptionId: data.subscriptionId
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

  /**
   * Enviar notificación de pago fallido
   */
  async sendPaymentFailed(userId: string, subscriptionId: string) {
    await this.createAndSend({
      userId,
      type: 'payment_failed' as NotificationType,
      title: 'Pago fallido',
      message: 'No pudimos procesar tu pago de suscripción. Por favor actualiza tu método de pago.',
      subscriptionId,
      data: {
        subscriptionId
      }
    });
  }

  async sendSubscriptionExpired(userId: string, subscriptionId: string) {
    await this.createAndSend({
      userId,
      type: 'subscription_expired' as NotificationType,
      title: 'Suscripción expirada',
      message: 'Tu suscripción ha expirado. Renueva ahora para seguir usando todos los beneficios.',
      subscriptionId,
      data: {
        subscriptionId
      }
    });
  }

  async sendSubscriptionExpiring(userId: string, subscriptionId: string, daysLeft: number) {
    await this.createAndSend({
      userId,
      type: 'subscription_expiring' as NotificationType,
      title: 'Tu suscripción está por vencer',
      message: `Tu suscripción vence en ${daysLeft} día${daysLeft > 1 ? 's' : ''}. Renueva ahora para no perder acceso.`,
      subscriptionId,
      data: {
        subscriptionId,
        daysLeft: daysLeft.toString()
      }
    });
  }

  /**
   * Enviar notificación de overtime cobrado
   */
  async sendOvertimeCharged(userId: string, reservationId: string, amount: number, hours: number) {
    await this.createAndSend({
      userId,
      type: 'overtime_charged' as NotificationType,
      title: 'Cargo por tiempo extra',
      message: `Se ha cobrado $${amount.toFixed(2)} MXN por ${hours.toFixed(1)} hora${hours > 1 ? 's' : ''} de tiempo extra.`,
      reservationId,
      data: {
        reservationId,
        amount: amount.toString(),
        hours: hours.toString()
      }
    });
  }

  /**
   * Enviar notificación de reserva confirmada
   */
  async sendReservationConfirmed(userId: string, reservationId: string, parkingName: string) {
    await this.createAndSend({
      userId,
      type: 'reservation_confirmed' as NotificationType,
      title: 'Reserva confirmada',
      message: `Tu reserva en ${parkingName} ha sido confirmada exitosamente.`,
      reservationId,
      data: {
        reservationId,
        parkingName
      }
    });
  }

  /**
   * Enviar recordatorio de reserva
   */
  async sendReservationReminder(userId: string, reservationId: string, parkingName: string, minutesBefore: number) {
    await this.createAndSend({
      userId,
      type: 'reservation_reminder' as NotificationType,
      title: 'Recordatorio de reserva',
      message: `Tu reserva en ${parkingName} inicia en ${minutesBefore} minutos.`,
      reservationId,
      data: {
        reservationId,
        parkingName,
        minutesBefore: minutesBefore.toString()
      }
    });
  }

  /**
   * Enviar notificación para solicitar reseña al completar una reserva
   */
  async sendReservationCompletedReviewPrompt(
    userId: string,
    reservationId: string,
    parkingLotId: string,
    parkingName: string
  ) {
    await this.createAndSend({
      userId,
      type: NotificationType.RESERVATION_COMPLETED,
      title: 'Reserva finalizada',
      message: `Tu reserva en ${parkingName} terminó. Cuéntanos tu experiencia.`,
      reservationId,
      data: {
        reservationId,
        parkingLotId,
        screen: 'review',
        action: 'open_review'
      }
    });
  }

  /**
   * Enviar advertencia de overtime
   */
  async sendOvertimeWarning(userId: string, reservationId: string, minutesOver: number) {
    await this.createAndSend({
      userId,
      type: 'overtime_warning' as NotificationType,
      title: 'Advertencia de tiempo extra',
      message: `Has excedido tu tiempo de reserva por ${minutesOver} minutos. Se aplicarán cargos adicionales.`,
      reservationId,
      data: {
        reservationId,
        minutesOver: minutesOver.toString()
      }
    });
  }

  /**
   * Enviar notificación de pago recibido
   */
  async sendPaymentReceived(userId: string, amount: number, reservationId?: string) {
    await this.createAndSend({
      userId,
      type: 'payment_received' as NotificationType,
      title: 'Pago recibido',
      message: `Hemos recibido tu pago de $${amount.toFixed(2)} MXN exitosamente.`,
      reservationId,
      data: {
        amount: amount.toString(),
        ...(reservationId && { reservationId })
      }
    });
  }

  /**
   * Enviar notificación de estacionamiento aprobado
   */
  async sendParkingApproved(userId: string, parkingName: string) {
    await this.createAndSend({
      userId,
      type: 'parking_approved' as NotificationType,
      title: 'Estacionamiento aprobado',
      message: `Tu estacionamiento "${parkingName}" ha sido aprobado y ya está disponible en la plataforma.`,
      data: {
        parkingName
      }
    });
  }
}

export default new NotificationService();
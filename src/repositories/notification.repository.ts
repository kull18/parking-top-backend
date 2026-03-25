// src/repositories/notification.repository.ts
import prisma from '@/config/database';
import { NotificationType } from '@/types/enums';

export class NotificationRepository {

  /**
   * Buscar notificación por ID
   */
  async findById(id: string) {
    return await prisma.notification.findUnique({
      where: { id }
    });
  }

  /**
   * Buscar notificaciones del usuario
   */
  async findByUser(userId: string, skip: number, take: number, isRead?: boolean) {
    const where: any = { userId };
    
    if (isRead !== undefined) {
      where.isRead = isRead;
    }

    return await Promise.all([
      prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take
      }),
      prisma.notification.count({ where })
    ]);
  }

  /**
   * Crear notificación
   */
  async create(data: {
    userId: string;
    type: string | NotificationType;
    title: string;
    message: string;
    reservationId?: string;
    subscriptionId?: string;
    data?: any;
  }) {
    return await prisma.notification.create({
      data: {
        userId: data.userId,
        type: data.type,
        title: data.title,
        message: data.message,
        reservationId: data.reservationId,
        subscriptionId: data.subscriptionId,
        data: data.data,
        isRead: false,
        isSent: false
      }
    });
  }

  /**
   * Marcar como leída
   */
  async markAsRead(id: string) {
    return await prisma.notification.update({
      where: { id },
      data: {
        isRead: true,
        readAt: new Date()
      }
    });
  }

  /**
   * Marcar todas como leídas
   */
  async markAllAsRead(userId: string): Promise<number> {
    const result = await prisma.notification.updateMany({
      where: {
        userId,
        isRead: false
      },
      data: {
        isRead: true,
        readAt: new Date()
      }
    });

    return result.count;
  }

  /**
   * Contar no leídas
   */
  async countUnread(userId: string): Promise<number> {
    return await prisma.notification.count({
      where: {
        userId,
        isRead: false
      }
    });
  }

  /**
   * Eliminar notificación
   */
  async delete(id: string) {
    return await prisma.notification.delete({
      where: { id }
    });
  }

  /**
   * Marcar como enviada
   */
  async markAsSent(id: string) {
    return await prisma.notification.update({
      where: { id },
      data: {
        isSent: true,
        sentAt: new Date()
      }
    });
  }
}

export default new NotificationRepository();
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
    type: NotificationType;
    title: string;
    message: string;
    reservationId?: string;
  }) {
    return await prisma.notification.create({
      data: {
        ...data,
        isRead: false
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
}

export default new NotificationRepository();
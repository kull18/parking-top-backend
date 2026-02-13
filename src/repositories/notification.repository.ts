import prisma from '@/config/database';
import { NotificationType } from '@/types/enums';

export class NotificationRepository {
  
  async findById(id: string) {
    return await prisma.notification.findUnique({
      where: { id }
    });
  }

  async findByUserId(
    userId: string,
    options?: {
      unreadOnly?: boolean;
      limit?: number;
    }
  ) {
    return await prisma.notification.findMany({
      where: {
        userId,
        ...(options?.unreadOnly && { isRead: false })
      },
      orderBy: { createdAt: 'desc' },
      take: options?.limit || 50
    });
  }

  async create(data: {
    userId: string;
    type: NotificationType;
    title: string;
    message: string;
    reservationId?: string;
    subscriptionId?: string;
    data?: any;
    isRead?: boolean;
    isSent?: boolean;
  }) {
    return await prisma.notification.create({
      data: {
        ...data,
        isRead: data.isRead ?? false,
        isSent: data.isSent ?? false
      }
    });
  }

  async update(id: string, data: any) {
    return await prisma.notification.update({
      where: { id },
      data
    });
  }

  async markAsRead(notificationId: string) {
    return await prisma.notification.update({
      where: { id: notificationId },
      data: {
        isRead: true,
        readAt: new Date()
      }
    });
  }

  async markAllAsRead(userId: string) {
    return await prisma.notification.updateMany({
      where: {
        userId,
        isRead: false
      },
      data: {
        isRead: true,
        readAt: new Date()
      }
    });
  }

  async countUnread(userId: string) {
    return await prisma.notification.count({
      where: {
        userId,
        isRead: false
      }
    });
  }

  async deleteOldNotifications(olderThan: Date) {
    return await prisma.notification.deleteMany({
      where: {
        isRead: true,
        readAt: { lt: olderThan }
      }
    });
  }

  async findPendingToSend() {
    return await prisma.notification.findMany({
      where: {
        isSent: false
      },
      take: 100
    });
  }

  async findByType(userId: string, type: NotificationType) {
    return await prisma.notification.findMany({
      where: {
        userId,
        type
      },
      orderBy: { createdAt: 'desc' }
    });
  }

  async findByReservationId(reservationId: string) {
    return await prisma.notification.findMany({
      where: { reservationId },
      orderBy: { createdAt: 'desc' }
    });
  }

  async findBySubscriptionId(subscriptionId: string) {
    return await prisma.notification.findMany({
      where: { subscriptionId },
      orderBy: { createdAt: 'desc' }
    });
  }

  async bulkCreate(notifications: Array<{
    userId: string;
    type: NotificationType;
    title: string;
    message: string;
    reservationId?: string;
    subscriptionId?: string;
  }>) {
    return await prisma.notification.createMany({
      data: notifications.map(n => ({
        ...n,
        isRead: false,
        isSent: false
      }))
    });
  }
}

export default new NotificationRepository();
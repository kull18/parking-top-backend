import { Response, NextFunction } from 'express';
import { AuthRequest } from '@/types/interfaces';
import prisma from '@/config/database';
import { sendSuccess, sendError } from '@/utils/response';

export class UserController {
  
  async getProfile(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;

      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          email: true,
          fullName: true,
          phone: true,
          role: true,
          status: true,
          profileImageUrl: true,
          emailVerified: true,
          phoneVerified: true,
          createdAt: true
        }
      });

      if (!user) {
        sendError(res, 'USER_NOT_FOUND', 'Usuario no encontrado', 404);
        return;
      }

      sendSuccess(res, user);
    } catch (error) {
      next(error);
    }
  }

  async updateProfile(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const { fullName, phone, profileImageUrl } = req.body;

      const user = await prisma.user.update({
        where: { id: userId },
        data: {
          fullName,
          phone,
          profileImageUrl
        },
        select: {
          id: true,
          email: true,
          fullName: true,
          phone: true,
          profileImageUrl: true
        }
      });

      sendSuccess(res, user);
    } catch (error) {
      next(error);
    }
  }

  async getVehicles(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;

      const vehicles = await prisma.vehicle.findMany({
        where: { userId },
        orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }]
      });

      sendSuccess(res, vehicles);
    } catch (error) {
      next(error);
    }
  }

  async addVehicle(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const { licensePlate, brand, model, color, vehicleType, isDefault } = req.body;

      // Si es default, quitar default de otros vehículos
      if (isDefault) {
        await prisma.vehicle.updateMany({
          where: { userId },
          data: { isDefault: false }
        });
      }

      const vehicle = await prisma.vehicle.create({
        data: {
          userId,
          licensePlate,
          brand,
          model,
          color,
          vehicleType,
          isDefault: isDefault || false
        }
      });

      sendSuccess(res, vehicle, 201);
    } catch (error: any) {
      if (error.code === 'P2002') {
        sendError(res, 'DUPLICATE_VEHICLE', 'Ya tienes un vehículo con estas placas', 400);
      } else {
        next(error);
      }
    }
  }

  async updateVehicle(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const { id } = req.params;
      const { brand, model, color, vehicleType, isDefault } = req.body;

      const vehicle = await prisma.vehicle.findFirst({
        where: { id, userId }
      });

      if (!vehicle) {
        sendError(res, 'VEHICLE_NOT_FOUND', 'Vehículo no encontrado', 404);
        return;
      }

      if (isDefault) {
        await prisma.vehicle.updateMany({
          where: { userId, id: { not: id } },
          data: { isDefault: false }
        });
      }

      const updated = await prisma.vehicle.update({
        where: { id },
        data: { brand, model, color, vehicleType, isDefault }
      });

      sendSuccess(res, updated);
    } catch (error) {
      next(error);
    }
  }

  async deleteVehicle(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const { id } = req.params;

      const vehicle = await prisma.vehicle.findFirst({
        where: { id, userId }
      });

      if (!vehicle) {
        sendError(res, 'VEHICLE_NOT_FOUND', 'Vehículo no encontrado', 404);
        return;
      }

      await prisma.vehicle.delete({ where: { id } });

      sendSuccess(res, { message: 'Vehículo eliminado' });
    } catch (error) {
      next(error);
    }
  }

  async getNotifications(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const { unread } = req.query;

      const notifications = await prisma.notification.findMany({
        where: {
          userId,
          ...(unread === 'true' && { isRead: false })
        },
        orderBy: { createdAt: 'desc' },
        take: 50
      });

      const unreadCount = await prisma.notification.count({
        where: { userId, isRead: false }
      });

      sendSuccess(res, {
        notifications,
        unreadCount
      });
    } catch (error) {
      next(error);
    }
  }

  async markNotificationAsRead(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const { id } = req.params;

      const notification = await prisma.notification.findFirst({
        where: { id, userId }
      });

      if (!notification) {
        sendError(res, 'NOTIFICATION_NOT_FOUND', 'Notificación no encontrada', 404);
        return;
      }

      await prisma.notification.update({
        where: { id },
        data: { isRead: true, readAt: new Date() }
      });

      sendSuccess(res, { message: 'Notificación marcada como leída' });
    } catch (error) {
      next(error);
    }
  }

  async markAllNotificationsAsRead(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;

      await prisma.notification.updateMany({
        where: { userId, isRead: false },
        data: { isRead: true, readAt: new Date() }
      });

      sendSuccess(res, { message: 'Todas las notificaciones marcadas como leídas' });
    } catch (error) {
      next(error);
    }
  }
}

export default new UserController();
import { Response, NextFunction } from 'express';
import { AuthRequest } from '@/types/interfaces';
import userService from '@/services/user.service';
import authService from '@/services/auth.service';
import notificationService from '@/services/notification.service';
import cloudinaryService from '@/integrations/cloudinary.client';
import { sendSuccess, sendError } from '@/utils/response';

export class UserController {
  
  async getProfile(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;

      const user = await authService.getUserById(userId);

      sendSuccess(res, user);
    } catch (error: any) {
      if (error.message === 'USER_NOT_FOUND') {
        sendError(res, 'USER_NOT_FOUND', 'Usuario no encontrado', 404);
      } else {
        next(error);
      }
    }
  }

  async updateProfile(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const { fullName, phone } = req.body;

      const user = await authService.updateUserProfile(userId, { fullName, phone });

      sendSuccess(res, user);
    } catch (error) {
      next(error);
    }
  }

  async uploadProfileImage(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const file = req.file as Express.Multer.File;

      if (!file) {
        sendError(res, 'NO_FILE', 'No se proporcionó imagen', 400);
        return;
      }

      // Obtener usuario actual
      const currentUser = await authService.getUserById(userId);

      // Eliminar imagen anterior de Cloudinary si existe
      if (currentUser.profileImageUrl) {
        const publicId = cloudinaryService.extractPublicId(currentUser.profileImageUrl);
        await cloudinaryService.deleteImage(publicId).catch(() => {});
      }

      // Subir nueva imagen
      const result = await cloudinaryService.uploadBuffer(file.buffer, {
        folder: 'parking-top/profiles',
        publicId: `user-${userId}`,
        width: 400,
        height: 400
      });

      // Actualizar usuario
      const updated = await authService.updateUserProfile(userId, {
        profileImageUrl: result.secureUrl
      });

      sendSuccess(res, updated);
    } catch (error) {
      next(error);
    }
  }

  async getVehicles(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;

      const vehicles = await userService.getVehicles(userId);

      sendSuccess(res, vehicles);
    } catch (error) {
      next(error);
    }
  }

  async addVehicle(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const { licensePlate, brand, model, color, vehicleType, isDefault } = req.body;

      const vehicle = await userService.addVehicle(userId, {
        licensePlate,
        brand,
        model,
        color,
        vehicleType,
        isDefault
      });

      sendSuccess(res, vehicle, 201);
    } catch (error: any) {
      if (error.message === 'DUPLICATE_VEHICLE') {
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

      const updated = await userService.updateVehicle(userId, id, {
        brand,
        model,
        color,
        vehicleType,
        isDefault
      });

      sendSuccess(res, updated);
    } catch (error: any) {
      if (error.message === 'VEHICLE_NOT_FOUND') {
        sendError(res, 'VEHICLE_NOT_FOUND', 'Vehículo no encontrado', 404);
      } else {
        next(error);
      }
    }
  }

  async deleteVehicle(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const { id } = req.params;

      await userService.deleteVehicle(userId, id);

      sendSuccess(res, { message: 'Vehículo eliminado' });
    } catch (error: any) {
      if (error.message === 'VEHICLE_NOT_FOUND') {
        sendError(res, 'VEHICLE_NOT_FOUND', 'Vehículo no encontrado', 404);
      } else {
        next(error);
      }
    }
  }

  async getNotifications(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;

      const { page = '1', perPage = '20', unread } = req.query;
      const pageNum = parseInt(page as string, 10);
      const perPageNum = parseInt(perPage as string, 10);
      
      let isRead: boolean | undefined;
      if (unread !== undefined) {
        isRead = unread === 'false';
      }
      const result = await notificationService.getUserNotifications(
        userId,
        pageNum,      // ✅ page (number)
        perPageNum,   // ✅ perPage (number)
        isRead        // ✅ isRead (boolean opcional)
        );

      sendSuccess(res, result);
    } catch (error) {
      next(error);
    }
  }

  async markNotificationAsRead(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const { id } = req.params;

      await notificationService.markAsRead(userId, id);

      sendSuccess(res, { message: 'Notificación marcada como leída' });
    } catch (error: any) {
      if (error.message === 'NOTIFICATION_NOT_FOUND') {
        sendError(res, 'NOTIFICATION_NOT_FOUND', 'Notificación no encontrada', 404);
      } else {
        next(error);
      }
    }
  }

  async markAllNotificationsAsRead(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;

      await notificationService.markAllAsRead(userId);

      sendSuccess(res, { message: 'Todas las notificaciones marcadas como leídas' });
    } catch (error) {
      next(error);
    }
  }
}

export default new UserController();
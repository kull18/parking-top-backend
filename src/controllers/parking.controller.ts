import { Response, NextFunction } from 'express';
import { AuthRequest } from '@/types/interfaces';
import parkingService from '@/services/parking.service';
import cloudinaryService from '@/integrations/cloudinary.client';
import { sendSuccess, sendError } from '@/utils/response';
import logger from '@/utils/logger';

export class ParkingController {
  
  async getNearby(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { latitude, longitude, radius = 5000 } = req.query;

      const lat = parseFloat(latitude as string);
      const lng = parseFloat(longitude as string);
      const rad = parseInt(radius as string, 10);

      const parkings = await parkingService.getNearby(lat, lng, rad);

      sendSuccess(res, parkings);
    } catch (error: any) {
      logger.error('Error getting nearby parkings:', error);
      sendError(res, 'NEARBY_ERROR', error.message, 400);
    }
  }

  async getById(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;

      const parking = await parkingService.getById(id);

      if (!parking) {
        sendError(res, 'NOT_FOUND', 'Estacionamiento no encontrado', 404);
        return;
      }

      sendSuccess(res, parking);
    } catch (error) {
      next(error);
    }
  }

  async create(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const parkingData = req.body;
      const files = req.files as Express.Multer.File[];

      // Subir imágenes a Cloudinary
      const imageUrls: string[] = [];

      if (files && files.length > 0) {
        for (const file of files) {
          const result = await cloudinaryService.uploadBuffer(file.buffer, {
            folder: 'parking-top/parkings'
          });
          imageUrls.push(result.secureUrl);
        }
      }

      // Crear estacionamiento a través del servicio
      const parking = await parkingService.create(userId, {
        ...parkingData,
        images: imageUrls
      });

      sendSuccess(res, parking, 201);
    } catch (error: any) {
      logger.error('Error creating parking:', error);
      
      if (error.message === 'NO_SUBSCRIPTION') {
        sendError(res, 'NO_SUBSCRIPTION', 'Necesitas una suscripción activa', 403);
      } else if (error.message.includes('límite')) {
        sendError(res, 'LIMIT_EXCEEDED', error.message, 403);
      } else {
        sendError(res, 'CREATE_ERROR', error.message, 400);
      }
    }
  }

  async update(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const userId = req.user!.userId;
      const updateData = req.body;
      const files = req.files as Express.Multer.File[];

      // Obtener parking actual
      const currentParking = await parkingService.getById(id);

      if (!currentParking) {
        sendError(res, 'NOT_FOUND', 'Estacionamiento no encontrado', 404);
        return;
      }

      if (currentParking.ownerId !== userId) {
        sendError(res, 'FORBIDDEN', 'No tienes permiso para editar este estacionamiento', 403);
        return;
      }

      // Subir nuevas imágenes si se enviaron
      let imageUrls: string[] | undefined;

      if (files && files.length > 0) {
        imageUrls = [];

        // Eliminar imágenes anteriores de Cloudinary
        for (const oldUrl of currentParking.images) {
          const publicId = cloudinaryService.extractPublicId(oldUrl);
          await cloudinaryService.deleteImage(publicId).catch(() => {});
        }

        // Subir nuevas imágenes
        for (const file of files) {
          const result = await cloudinaryService.uploadBuffer(file.buffer, {
            folder: 'parking-top/parkings'
          });
          imageUrls.push(result.secureUrl);
        }
      }

      // Actualizar a través del servicio
      const updated = await parkingService.update(id, userId, {
        ...updateData,
        ...(imageUrls && { images: imageUrls })
      });

      sendSuccess(res, updated);
    } catch (error: any) {
      if (error.message === 'NOT_FOUND') {
        sendError(res, 'NOT_FOUND', 'Estacionamiento no encontrado', 404);
      } else if (error.message === 'FORBIDDEN') {
        sendError(res, 'FORBIDDEN', 'No tienes permiso para editar este estacionamiento', 403);
      } else {
        next(error);
      }
    }
  }

  async delete(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const userId = req.user!.userId;

      await parkingService.delete(id, userId);

      sendSuccess(res, { message: 'Estacionamiento eliminado exitosamente' });
    } catch (error: any) {
      if (error.message === 'NOT_FOUND') {
        sendError(res, 'NOT_FOUND', 'Estacionamiento no encontrado', 404);
      } else if (error.message === 'FORBIDDEN') {
        sendError(res, 'FORBIDDEN', 'No tienes permiso para eliminar este estacionamiento', 403);
      } else {
        next(error);
      }
    }
  }

  async getOwnerParkings(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;

      const parkings = await parkingService.getOwnerParkings(userId);

      sendSuccess(res, parkings);
    } catch (error) {
      next(error);
    }
  }
}

export default new ParkingController();
import { Response, NextFunction } from 'express';
import { AuthRequest } from '@/types/interfaces';
import prisma from '@/config/database';
import cloudinaryService from '@/integrations/cloudinary.client';
import { sendSuccess, sendError } from '@/utils/response';
import { calculateDistance } from '@/utils/helpers';
import logger from '@/utils/logger';

export class ParkingController {
  
  async getNearby(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { latitude, longitude, radius = 5000 } = req.query;

      const lat = parseFloat(latitude as string);
      const lng = parseFloat(longitude as string);
      const rad = parseInt(radius as string, 10);

      const parkings = await prisma.parkingLot.findMany({
        where: { status: 'active' },
        include: {
          owner: {
            select: {
              id: true,
              fullName: true,
              email: true
            }
          }
        }
      });

      const nearbyParkings = parkings
        .map(parking => ({
          ...parking,
          distance: calculateDistance(lat, lng, Number(parking.latitude), Number(parking.longitude))
        }))
        .filter(parking => parking.distance <= rad)
        .sort((a, b) => a.distance - b.distance);

      sendSuccess(res, nearbyParkings);
    } catch (error: any) {
      logger.error('Error getting nearby parkings:', error);
      sendError(res, 'NEARBY_ERROR', error.message, 400);
    }
  }

  async getById(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;

      const parking = await prisma.parkingLot.findUnique({
        where: { id },
        include: {
          owner: {
            select: {
              id: true,
              fullName: true,
              email: true
            }
          },
          spots: true,
          reviews: {
            include: {
              user: {
                select: {
                  id: true,
                  fullName: true,
                  profileImageUrl: true
                }
              }
            },
            orderBy: { createdAt: 'desc' },
            take: 10
          }
        }
      });

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

      // Verificar suscripción activa
      const subscription = await prisma.subscription.findFirst({
        where: {
          userId,
          status: { in: ['active', 'trial'] }
        },
        include: { plan: true }
      });

      if (!subscription) {
        sendError(res, 'NO_SUBSCRIPTION', 'Necesitas una suscripción activa', 403);
        return;
      }

      // Verificar límites del plan
      const currentParkings = await prisma.parkingLot.count({
        where: {
          ownerId: userId,
          status: { not: 'inactive' }
        }
      });

      if (
        subscription.plan.maxParkingLots !== null &&
        currentParkings >= subscription.plan.maxParkingLots
      ) {
        sendError(
          res,
          'LIMIT_EXCEEDED',
          `Has alcanzado el límite de ${subscription.plan.maxParkingLots} estacionamientos`,
          403
        );
        return;
      }

      if (
        subscription.plan.maxSpotsPerLot !== null &&
        parkingData.totalSpots > subscription.plan.maxSpotsPerLot
      ) {
        sendError(
          res,
          'SPOTS_LIMIT_EXCEEDED',
          `Tu plan solo permite ${subscription.plan.maxSpotsPerLot} espacios por estacionamiento`,
          403
        );
        return;
      }

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

      // Crear estacionamiento
      const parking = await prisma.parkingLot.create({
        data: {
          ownerId: userId,
          subscriptionId: subscription.id,
          name: parkingData.name,
          description: parkingData.description,
          address: parkingData.address,
          city: parkingData.city,
          state: parkingData.state,
          postalCode: parkingData.postalCode,
          latitude: parkingData.latitude,
          longitude: parkingData.longitude,
          totalSpots: parseInt(parkingData.totalSpots),
          availableSpots: parseInt(parkingData.totalSpots),
          basePricePerHour: parseFloat(parkingData.basePricePerHour),
          overtimeRatePerHour: parseFloat(parkingData.overtimeRatePerHour),
          features: parkingData.features || [],
          images: imageUrls,
          operatingHours: parkingData.operatingHours || {},
          status: 'pending_approval',
          subscriptionVerifiedAt: new Date()
        }
      });

      // Crear espacios
      const spots = Array.from({ length: parseInt(parkingData.totalSpots) }, (_, i) => ({
        parkingLotId: parking.id,
        spotNumber: String(i + 1),
        status: 'available' as const,
        vehicleType: 'car' as const
      }));

      await prisma.parkingSpot.createMany({ data: spots });

      sendSuccess(res, parking, 201);
    } catch (error: any) {
      logger.error('Error creating parking:', error);
      sendError(res, 'CREATE_ERROR', error.message, 400);
    }
  }

  async update(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const userId = req.user!.userId;
      const updateData = req.body;
      const files = req.files as Express.Multer.File[];

      const parking = await prisma.parkingLot.findUnique({ where: { id } });

      if (!parking) {
        sendError(res, 'NOT_FOUND', 'Estacionamiento no encontrado', 404);
        return;
      }

      if (parking.ownerId !== userId) {
        sendError(res, 'FORBIDDEN', 'No tienes permiso para editar este estacionamiento', 403);
        return;
      }

      // Subir nuevas imágenes si se enviaron
      let imageUrls: string[] | undefined;

      if (files && files.length > 0) {
        imageUrls = [];

        // Eliminar imágenes anteriores de Cloudinary
        for (const oldUrl of parking.images) {
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

      const updated = await prisma.parkingLot.update({
        where: { id },
        data: {
          ...updateData,
          ...(imageUrls && { images: imageUrls })
        }
      });

      sendSuccess(res, updated);
    } catch (error) {
      next(error);
    }
  }

  async delete(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const userId = req.user!.userId;

      const parking = await prisma.parkingLot.findUnique({ where: { id } });

      if (!parking) {
        sendError(res, 'NOT_FOUND', 'Estacionamiento no encontrado', 404);
        return;
      }

      if (parking.ownerId !== userId) {
        sendError(res, 'FORBIDDEN', 'No tienes permiso para eliminar este estacionamiento', 403);
        return;
      }

      await prisma.parkingLot.update({
        where: { id },
        data: { status: 'inactive' }
      });

      sendSuccess(res, { message: 'Estacionamiento eliminado exitosamente' });
    } catch (error) {
      next(error);
    }
  }

  async getOwnerParkings(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;

      const parkings = await prisma.parkingLot.findMany({
        where: {
          ownerId: userId,
          status: { not: 'inactive' }
        },
        include: {
          subscription: {
            include: { plan: true }
          },
          _count: {
            select: {
              reviews: true,
              reservations: true
            }
          }
        },
        orderBy: { createdAt: 'desc' }
      });

      sendSuccess(res, parkings);
    } catch (error) {
      next(error);
    }
  }
}

export default new ParkingController();
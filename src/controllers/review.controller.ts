import { Response, NextFunction } from 'express';
import { AuthRequest } from '@/types/interfaces';
import prisma from '@/config/database';
import { sendSuccess, sendError } from '@/utils/response';
import logger from '@/utils/logger';

export class ReviewController {
  
  async create(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const { parkingLotId, reservationId, rating, comment } = req.body;

      // Verificar que no haya reseña previa
      const existingReview = await prisma.review.findUnique({
        where: {
          userId_reservationId: {
            userId,
            reservationId
          }
        }
      });

      if (existingReview) {
        sendError(res, 'DUPLICATE_REVIEW', 'Ya has calificado esta reserva', 400);
        return;
      }

      // Crear reseña
      const review = await prisma.review.create({
        data: {
          userId,
          parkingLotId,
          reservationId,
          rating,
          comment
        }
      });

      // Actualizar rating del estacionamiento
      const reviews = await prisma.review.findMany({
        where: { parkingLotId },
        select: { rating: true }
      });

    const avgRating = reviews.reduce((sum: number, r: { rating: number }) => sum + r.rating, 0) / reviews.length;

      await prisma.parkingLot.update({
        where: { id: parkingLotId },
        data: {
          ratingAverage: avgRating,
          totalReviews: reviews.length
        }
      });

      sendSuccess(res, review, 201);
    } catch (error) {
      logger.error('Error creating review:', error);
      next(error);
    }
  }

  async getParkingReviews(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { parkingId } = req.params;
      const { page = 1, perPage = 10 } = req.query;

      const skip = (Number(page) - 1) * Number(perPage);

      const [reviews, total] = await Promise.all([
        prisma.review.findMany({
          where: { parkingLotId: parkingId },
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
          skip,
          take: Number(perPage)
        }),
        prisma.review.count({
          where: { parkingLotId: parkingId }
        })
      ]);

      sendSuccess(res, reviews, 200, {
        page: Number(page),
        perPage: Number(perPage),
        total,
        totalPages: Math.ceil(total / Number(perPage))
      });
    } catch (error) {
      next(error);
    }
  }

  async respondToReview(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const { reviewId } = req.params;
      const { response } = req.body;

      const review = await prisma.review.findUnique({
        where: { id: reviewId },
        include: { parkingLot: true }
      });

      if (!review) {
        sendError(res, 'NOT_FOUND', 'Reseña no encontrada', 404);
        return;
      }

      if (review.parkingLot.ownerId !== userId) {
        sendError(res, 'FORBIDDEN', 'No tienes permiso para responder esta reseña', 403);
        return;
      }

      const updated = await prisma.review.update({
        where: { id: reviewId },
        data: {
          ownerResponse: response,
          ownerResponseAt: new Date()
        }
      });

      // Notificar al usuario
      await prisma.notification.create({
        data: {
          userId: review.userId,
          type: 'general',
          title: 'El propietario respondió tu reseña',
          message: `${review.parkingLot.name} respondió tu reseña`,
          isRead: false,
          isSent: false
        }
      });

      sendSuccess(res, updated);
    } catch (error) {
      next(error);
    }
  }
}

export default new ReviewController();
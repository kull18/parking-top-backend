// src/controllers/review.controller.ts
import { Response, NextFunction } from 'express';
import { AuthRequest } from '@/types/interfaces';
import reviewService from '@/services/review.service';
import { sendSuccess, sendError } from '@/utils/response';
import logger from '@/utils/logger';

export class ReviewController {
  
  /**
   * Crear nueva reseña
   * POST /reviews
   */
  async create(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const { parkingLotId, reservationId, rating, comment } = req.body;

      const review = await reviewService.createReview(
        userId,
        parkingLotId,
        reservationId,
        rating,
        comment
      );

      sendSuccess(res, review, 201);
    } catch (error: any) {
      logger.error('Error creating review:', error);
      
      if (error.message === 'Reserva no encontrada') {
        sendError(res, 'NOT_FOUND', error.message, 404);
      } else if (error.message.includes('permiso')) {
        sendError(res, 'FORBIDDEN', error.message, 403);
      } else if (error.message.includes('completadas') || error.message.includes('calificado')) {
        sendError(res, 'INVALID_STATUS', error.message, 400);
      } else {
        next(error);
      }
    }
  }

  /**
   * Obtener reseñas de un estacionamiento
   * GET /reviews/parking/:parkingId
   */
  async getParkingReviews(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { parkingId } = req.params;
      const { page = 1, perPage = 10 } = req.query;

      const result = await reviewService.getParkingReviews(
        parkingId,
        Number(page),
        Number(perPage)
      );

      sendSuccess(res, result.reviews, 200, result.pagination);
    } catch (error) {
      logger.error('Error getting parking reviews:', error);
      next(error);
    }
  }

  /**
   * Obtener reseña por ID
   * GET /reviews/:id
   */
  async getById(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;

      const review = await reviewService.getReviewById(id);

      sendSuccess(res, review);
    } catch (error: any) {
      logger.error('Error getting review:', error);
      
      if (error.message === 'Reseña no encontrada') {
        sendError(res, 'NOT_FOUND', error.message, 404);
      } else {
        next(error);
      }
    }
  }

  /**
   * Actualizar reseña
   * PUT /reviews/:id
   */
  async update(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const { id } = req.params;
      const { rating, comment } = req.body;

      const updated = await reviewService.updateReview(id, userId, rating, comment);

      sendSuccess(res, updated);
    } catch (error: any) {
      logger.error('Error updating review:', error);
      
      if (error.message === 'Reseña no encontrada') {
        sendError(res, 'NOT_FOUND', error.message, 404);
      } else if (error.message.includes('permiso')) {
        sendError(res, 'FORBIDDEN', error.message, 403);
      } else {
        next(error);
      }
    }
  }

  /**
   * Eliminar reseña
   * DELETE /reviews/:id
   */
  async delete(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const { id } = req.params;

      const result = await reviewService.deleteReview(id, userId);

      sendSuccess(res, result);
    } catch (error: any) {
      logger.error('Error deleting review:', error);
      
      if (error.message === 'Reseña no encontrada') {
        sendError(res, 'NOT_FOUND', error.message, 404);
      } else if (error.message.includes('permiso')) {
        sendError(res, 'FORBIDDEN', error.message, 403);
      } else {
        next(error);
      }
    }
  }

  /**
   * Responder a una reseña
   * POST /reviews/:id/respond
   */
  async respondToReview(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const { id } = req.params;
      const { response } = req.body;

      const updated = await reviewService.respondToReview(id, userId, response);

      sendSuccess(res, updated);
    } catch (error: any) {
      logger.error('Error responding to review:', error);
      
      if (error.message === 'Reseña no encontrada') {
        sendError(res, 'NOT_FOUND', error.message, 404);
      } else if (error.message.includes('permiso')) {
        sendError(res, 'FORBIDDEN', error.message, 403);
      } else {
        next(error);
      }
    }
  }

  /**
   * Obtener mis reseñas
   * GET /reviews/me/reviews
   */
  async getMyReviews(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const { page = 1, perPage = 10 } = req.query;

      const result = await reviewService.getMyReviews(
        userId,
        Number(page),
        Number(perPage)
      );

      sendSuccess(res, result.reviews, 200, result.pagination);
    } catch (error) {
      logger.error('Error getting my reviews:', error);
      next(error);
    }
  }
}

export default new ReviewController();
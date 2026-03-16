// src/services/review.service.ts
import reviewRepository from '@/repositories/review.repository';
import reservationRepository from '@/repositories/reservation.repository';
import parkingRepository from '@/repositories/parking.repository';
import notificationRepository from '@/repositories/notification.repository';
import { ReservationStatus, NotificationType } from '@/types/enums';
import firebaseService from '@/integrations/firebase.client';
import logger from '@/utils/logger';

export class ReviewService {

  /**
   * Crear nueva reseña
   */
  async createReview(
    userId: string,
    parkingLotId: string,
    reservationId: string,
    rating: number,
    comment?: string,
    userFullName?: string
  ) {
    // Verificar que la reserva existe y pertenece al usuario
    const reservation = await reservationRepository.findById(reservationId);

    if (!reservation) {
      throw new Error('Reserva no encontrada');
    }

    if (reservation.userId !== userId) {
      throw new Error('No tienes permiso para calificar esta reserva');
    }

    // Verificar que la reserva esté completada
    if (reservation.status !== ReservationStatus.COMPLETED) {
      throw new Error('Solo puedes calificar reservas completadas');
    }

    // Verificar que no haya reseña previa
    const existingReview = await reviewRepository.findByUserAndReservation(userId, reservationId);

    if (existingReview) {
      throw new Error('Ya has calificado esta reserva');
    }

    // Crear reseña
    const review = await reviewRepository.create({
      userId,
      parkingLotId,
      reservationId,
      rating,
      comment
    });

    // Actualizar rating del estacionamiento
    await this.updateParkingRating(parkingLotId);

    // Notificar al propietario
    const parking = await parkingRepository.findById(parkingLotId);
    
    if (parking) {
      await notificationRepository.create({
        userId: parking.ownerId,
        type: NotificationType.GENERAL,
        title: 'Nueva reseña recibida',
        message: `${userFullName || 'Un cliente'} dejó una reseña de ${rating} estrellas en ${parking.name}`
      });

      await firebaseService.sendToUser(parking.ownerId, {
        title: 'Nueva reseña',
        body: `Recibiste una calificación de ${rating} estrellas`,
        data: {
          type: 'new_review',
          reviewId: review.id,
          parkingLotId
        }
      });
    }

    logger.info(`Review created: ${review.id} for parking ${parkingLotId}`);

    return review;
  }

  /**
   * Obtener reseñas de un estacionamiento
   */
  async getParkingReviews(parkingLotId: string, page: number = 1, perPage: number = 10) {
    const skip = (page - 1) * perPage;
    const [reviews, total] = await reviewRepository.findByParkingLot(parkingLotId, skip, perPage);

    return {
      reviews,
      pagination: {
        page,
        perPage,
        total,
        totalPages: Math.ceil(total / perPage)
      }
    };
  }

  /**
   * Obtener reseña por ID
   */
  async getReviewById(id: string) {
    const review = await reviewRepository.findById(id);

    if (!review) {
      throw new Error('Reseña no encontrada');
    }

    return review;
  }

  /**
   * Actualizar reseña
   */
  async updateReview(id: string, userId: string, rating?: number, comment?: string) {
    const review = await reviewRepository.findById(id);

    if (!review) {
      throw new Error('Reseña no encontrada');
    }

    if (review.userId !== userId) {
      throw new Error('No tienes permiso para editar esta reseña');
    }

    const updated = await reviewRepository.update(id, { rating, comment });

    // Actualizar rating del estacionamiento
    await this.updateParkingRating(review.parkingLotId);

    logger.info(`Review updated: ${id}`);

    return updated;
  }

  /**
   * Eliminar reseña
   */
  async deleteReview(id: string, userId: string) {
    const review = await reviewRepository.findById(id);

    if (!review) {
      throw new Error('Reseña no encontrada');
    }

    if (review.userId !== userId) {
      throw new Error('No tienes permiso para eliminar esta reseña');
    }

    await reviewRepository.delete(id);

    // Actualizar rating del estacionamiento
    await this.updateParkingRating(review.parkingLotId);

    logger.info(`Review deleted: ${id}`);

    return { message: 'Reseña eliminada correctamente' };
  }

  /**
   * Responder a una reseña (solo propietario)
   */
  async respondToReview(id: string, userId: string, response: string) {
    const review = await reviewRepository.findById(id);

    if (!review) {
      throw new Error('Reseña no encontrada');
    }

    if (review.parkingLot.ownerId !== userId) {
      throw new Error('No tienes permiso para responder esta reseña');
    }

    const updated = await reviewRepository.addOwnerResponse(id, response);

    // Notificar al usuario
    await notificationRepository.create({
      userId: review.userId,
      type: NotificationType.GENERAL,
      title: 'El propietario respondió tu reseña',
      message: `${review.parkingLot.name} respondió tu reseña`
    });

    await firebaseService.sendToUser(review.userId, {
      title: 'Respuesta a tu reseña',
      body: `${review.parkingLot.name} respondió tu reseña`,
      data: {
        type: 'review_response',
        reviewId: id,
        parkingLotId: review.parkingLotId
      }
    });

    logger.info(`Owner responded to review: ${id}`);

    return updated;
  }

  /**
   * Obtener mis reseñas
   */
  async getMyReviews(userId: string, page: number = 1, perPage: number = 10) {
    const skip = (page - 1) * perPage;
    const [reviews, total] = await reviewRepository.findByUser(userId, skip, perPage);

    return {
      reviews,
      pagination: {
        page,
        perPage,
        total,
        totalPages: Math.ceil(total / perPage)
      }
    };
  }

  /**
   * Actualizar rating promedio de un estacionamiento
   */
  private async updateParkingRating(parkingLotId: string): Promise<void> {
    const reviews = await reviewRepository.findRatingsByParkingLot(parkingLotId);

    if (reviews.length === 0) {
      await parkingRepository.update(parkingLotId, {
        ratingAverage: '0',
        totalReviews: 0
      });
      return;
    }

    const avgRating = reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length;

    await parkingRepository.update(parkingLotId, {
      ratingAverage: avgRating.toFixed(1),
      totalReviews: reviews.length
    });

    logger.info(`Updated parking ${parkingLotId} rating to ${avgRating.toFixed(1)} (${reviews.length} reviews)`);
  }
}

export default new ReviewService();
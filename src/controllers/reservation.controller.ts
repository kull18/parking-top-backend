import { Response, NextFunction } from 'express';
import { AuthRequest } from '@/types/interfaces';
import reservationService from '@/services/reservation.service';
import { sendSuccess, sendError } from '@/utils/response';
import logger from '@/utils/logger';

export class ReservationController {

  async create(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const { parkingLotId, vehicleId, startTime, endTime, notes } = req.body;

      const reservation = await reservationService.create(userId, {
        parkingLotId,
        vehicleId,
        startTime: new Date(startTime),
        endTime: new Date(endTime),
        notes
      });

      sendSuccess(res, reservation, 201);
    } catch (error: any) {
      logger.error('Error creating reservation:', error);
      sendError(res, 'RESERVATION_ERROR', error.message, 400);
    }
  }

  async processPayment(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { reservationId } = req.params;

      // MercadoPago no necesita paymentMethodId, se ingresa en su página
      const result = await reservationService.processPayment(reservationId);

      sendSuccess(res, result);
    } catch (error: any) {
      sendError(res, 'PAYMENT_ERROR', error.message, 400);
    }
  }

  async confirmReservation(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { reservationId } = req.params;

      const reservation = await reservationService.confirmReservation(reservationId);

      sendSuccess(res, reservation);
    } catch (error: any) {
      sendError(res, 'CONFIRMATION_ERROR', error.message, 400);
    }
  }

  async checkIn(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { reservationId } = req.params;

      const reservation = await reservationService.checkIn(reservationId);

      sendSuccess(res, reservation);
    } catch (error: any) {
      sendError(res, 'CHECKIN_ERROR', error.message, 400);
    }
  }

  async checkOut(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { reservationId } = req.params;

      const reservation = await reservationService.checkOut(reservationId);

      sendSuccess(res, reservation);
    } catch (error: any) {
      sendError(res, 'CHECKOUT_ERROR', error.message, 400);
    }
  }

  async cancel(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const { reservationId } = req.params;
      const { reason } = req.body;

      const reservation = await reservationService.cancel(reservationId, userId, reason);

      sendSuccess(res, reservation);
    } catch (error: any) {
      sendError(res, 'CANCEL_ERROR', error.message, 400);
    }
  }

  async getUserReservations(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const { status } = req.query;

      const statusFilter = status ? (status as string).split(',') : undefined;

      const reservations = await reservationService.getUserReservations(
        userId,
        statusFilter as any
      );

      sendSuccess(res, reservations);
    } catch (error) {
      next(error);
    }
  }

  async getById(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;

      const reservation = await reservationService.getById(id);

      if (!reservation) {
        sendError(res, 'NOT_FOUND', 'Reserva no encontrada', 404);
        return;
      }

      sendSuccess(res, reservation);
    } catch (error) {
      next(error);
    }
  }
}

export default new ReservationController();
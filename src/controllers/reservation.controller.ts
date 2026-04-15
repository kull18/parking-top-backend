// src/controllers/reservation.controller.ts - COMPLETO
import { Response, NextFunction } from 'express';
import { AuthRequest } from '@/types/interfaces';
import reservationService from '@/services/reservation.service';
import { sendSuccess, sendError } from '@/utils/response';
import logger from '@/utils/logger';

export class ReservationController {

  /**
   * Crear reserva con método de pago
   */
  async create(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const {
        parkingLotId,
        parkingSpotId, // ✅ Nuevo: espacio específico
        vehicleId,
        startTime,
        endTime,
        paymentMethod = 'mercadopago' // ✅ Default: MercadoPago
      } = req.body;

      // Crear reserva
      const reservation = await reservationService.create(userId, {
        parkingLotId,
        parkingSpotId, // ✅ Incluir spot
        vehicleId,
        startTime: new Date(startTime),
        endTime: new Date(endTime),
        paymentMethod
      });

      // Procesar pago
      const paymentResult = await reservationService.processPayment(
        reservation.id,
        paymentMethod
      );

      sendSuccess(res, paymentResult, 201);
    } catch (error: any) {
      logger.error('Error creating reservation:', error);
      sendError(res, 'CREATE_ERROR', error.message, 400);
    }
  }

  /**
   * Confirmar pago en efectivo (Owner o Admin)
   */
  async confirmCashPayment(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;

      const reservation = await reservationService.confirmCashPayment(id);

      sendSuccess(res, {
        message: 'Pago en efectivo confirmado',
        reservation
      });
    } catch (error: any) {
      logger.error('Error confirming cash payment:', error);
      sendError(res, 'CONFIRM_ERROR', error.message, 400);
    }
  }

  /**
   * Check-in
   */
  async checkIn(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;

      const reservation = await reservationService.checkIn(id);

      sendSuccess(res, {
        message: 'Check-in exitoso',
        reservation
      });
    } catch (error: any) {
      logger.error('Error in check-in:', error);
      sendError(res, 'CHECKIN_ERROR', error.message, 400);
    }
  }

  /**
   * Check-out
   */
  async checkOut(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;

      const reservation = await reservationService.checkOut(id);

      sendSuccess(res, {
        message: 'Check-out exitoso',
        reservation
      });
    } catch (error: any) {
      logger.error('Error in check-out:', error);
      sendError(res, 'CHECKOUT_ERROR', error.message, 400);
    }
  }

  /**
   * Pagar overtime
   */
  async payOvertime(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const user = req.user!;

      const result = await reservationService.payOvertime(id, user.email);

      sendSuccess(res, result);
    } catch (error: any) {
      logger.error('Error paying overtime:', error);
      sendError(res, 'PAYMENT_ERROR', error.message, 400);
    }
  }

  /**
   * Cancelar reserva
   */
  async cancel(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const userId = req.user!.userId;
      const { reason } = req.body;

      const reservation = await reservationService.cancel(id, userId, reason);

      sendSuccess(res, {
        message: 'Reserva cancelada exitosamente',
        reservation
      });
    } catch (error: any) {
      logger.error('Error cancelling reservation:', error);
      sendError(res, 'CANCEL_ERROR', error.message, 400);
    }
  }

  /**
   * Obtener reservas del usuario
   */
  async getUserReservations(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const { status } = req.query;

      const statusFilter = status
        ? ((status as string).split(',') as Parameters<typeof reservationService.getUserReservations>[1])
        : undefined;

      const reservations = await reservationService.getUserReservations(userId, statusFilter);

      sendSuccess(res, reservations);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Obtener reservas de un estacionamiento
   */
  async getParkingReservations(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { parkingId } = req.params;
      const { status, startDate, endDate } = req.query;

      const filters = {
        ...(status && { status: (status as string).split(',') }),
        ...(startDate && { startDate }),
        ...(endDate && { endDate })
      };

      const reservations = await reservationService.getParkingReservations(parkingId, filters);

      sendSuccess(res, reservations);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Obtener todas las reservas del propietario (todos sus parkings)
   */
  async getOwnerReservations(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const ownerId = req.user!.userId;
      const { status, startDate, endDate } = req.query;

      const filters = {
        ...(status && { status: (status as string).split(',') }),
        ...(startDate && { startDate }),
        ...(endDate && { endDate })
      };

      const reservations = await reservationService.getOwnerReservations(ownerId, filters);

      sendSuccess(res, reservations);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Obtener reserva por ID
   */
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

  /**
   * Verificar disponibilidad
   */
  async checkAvailability(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { parkingLotId, startTime, endTime } = req.query;

      const availability = await reservationService.checkAvailability(
        parkingLotId as string,
        new Date(startTime as string),
        new Date(endTime as string)
      );

      sendSuccess(res, availability);
    } catch (error: any) {
      logger.error('Error checking availability:', error);
      sendError(res, 'AVAILABILITY_ERROR', error.message, 400);
    }
  }
}

export default new ReservationController();
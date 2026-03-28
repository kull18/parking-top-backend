import prisma from '@/config/database';
import reservationRepository from '@/repositories/reservation.repository';
import parkingRepository from '@/repositories/parking.repository';
import paymentRepository from '@/repositories/payment.repository';
import notificationService from '@/services/notification.service';
import { ReservationStatus, PaymentType, PaymentStatus } from '@/types/enums';
import { calculateHoursBetween, calculateCost, calculateCommission, generateReservationCode } from '@/utils/helpers';
import mercadopagoService from '@/integrations/mercadopago.client';
import logger from '@/utils/logger';
import balanceService from '@/services/balance.service';

export class ReservationService {

  /**
   * Crear reserva
   */
  async create(userId: string, data: {
    parkingLotId: string;
    vehicleId?: string;
    startTime: Date;
    endTime: Date;
    notes?: string;
  }) {
    try {
      const parking = await prisma.parkingLot.findUnique({
        where: { id: data.parkingLotId },
        include: { subscription: { include: { plan: true } } }
      });
      if (!parking) throw new Error('Estacionamiento no encontrado');

      const subscription = parking.subscription;

      const hours = calculateHoursBetween(data.startTime, data.endTime);
      const baseCost = calculateCost(hours, Number(parking.basePricePerHour));
      const commissionRate = Number(subscription?.plan.commissionRate ?? 15);
      const commissionAmount = calculateCommission(baseCost, commissionRate);

      const reservation = await reservationRepository.create({
        reservationCode: generateReservationCode(),
        userId,
        parkingLotId: data.parkingLotId,
        vehicleId: data.vehicleId,
        startTime: data.startTime,
        endTime: data.endTime,
        reservedHours: hours,
        baseCost,
        overtimeCost: 0,
        totalCost: baseCost,
        commissionRate,
        commissionAmount,
        notes: data.notes,
        status: ReservationStatus.PENDING
      });

      logger.info(`Reservation created: ${reservation.id}`);
      return reservation;
    } catch (error: any) {
      logger.error('Error creating reservation:', error);
      throw error;
    }
  }

  /**
   * Procesar pago de reserva con MercadoPago
   */
  async processPayment(reservationId: string) {
    try {
      const reservation = await reservationRepository.findById(reservationId);
      if (!reservation) throw new Error('Reserva no encontrada');

      const user = await prisma.user.findUnique({ where: { id: reservation.userId } });
      if (!user) throw new Error('Usuario no encontrado');

      const mpPayment = await mercadopagoService.createPayment({
        id: Date.now(),
        amount: Number(reservation.totalCost),
        description: `Reserva ${reservation.reservationCode} - ${reservation.parkingLot.name}`,
        payerEmail: user.email,
        metadata: {
          reservationId: reservation.id,
          userId: reservation.userId,
          type: 'reservation'
        }
      });

      const payment = await paymentRepository.create({
        userId: reservation.userId,
        paymentType: PaymentType.RESERVATION,
        reservationId: reservation.id,
        amount: Number(reservation.totalCost),
        commissionAmount: Number(reservation.commissionAmount),
        netAmount: Number(reservation.totalCost) - Number(reservation.commissionAmount),
        paymentMethod: 'mercadopago',
        status: PaymentStatus.PENDING,
        transactionId: mpPayment.id
      });

      return {
        reservation,
        payment,
        paymentUrl: mpPayment.init_point,
        paymentId: mpPayment.id
      };
    } catch (error: any) {
      logger.error('Error processing payment:', error);
      throw error;
    }
  }

  /**
   * Confirmar reserva (llamado desde webhook)
   */
  async confirmReservation(reservationId: string) {
    try {
      const reservation = await reservationRepository.update(reservationId, {
        status: ReservationStatus.CONFIRMED
      });

      await parkingRepository.updateAvailableSpots(reservation.parkingLotId, -1);

      const availableSpot = await prisma.parkingSpot.findFirst({
        where: { parkingLotId: reservation.parkingLotId, status: 'available' }
      });

      if (availableSpot) {
        await prisma.parkingSpot.update({
          where: { id: availableSpot.id },
          data: { status: 'reserved' }
        });

        await reservationRepository.update(reservationId, {
          parkingSpotId: availableSpot.id
        });
      }

      const parking = await parkingRepository.findById(reservation.parkingLotId);

      await notificationService.sendReservationConfirmed(
        reservation.userId,
        reservation.id,
        parking!.name
      );

      logger.info(`Reservation confirmed: ${reservationId}`);
      return reservation;
    } catch (error: any) {
      logger.error('Error confirming reservation:', error);
      throw error;
    }
  }

  /**
   * Check-in
   */
  async checkIn(reservationId: string) {
    const reservation = await reservationRepository.update(reservationId, {
      status: ReservationStatus.ACTIVE,
      checkInTime: new Date()
    });

    if (reservation.parkingSpotId) {
      await prisma.parkingSpot.update({
        where: { id: reservation.parkingSpotId },
        data: { status: 'occupied' }
      });
    }

    logger.info(`Check-in completed for reservation: ${reservationId}`);
    return reservation;
  }

  /**
   * Check-out
   */
  async checkOut(reservationId: string) {
    const reservation = await reservationRepository.findById(reservationId);
    if (!reservation) throw new Error('Reserva no encontrada');
 
    const now = new Date();
    const overtimeHours = calculateHoursBetween(reservation.endTime, now);
 
    let overtimeCost = 0;
 
    if (overtimeHours > 0) {
      const parking = await parkingRepository.findById(reservation.parkingLotId);
      overtimeCost = calculateCost(overtimeHours, Number(parking!.overtimeRatePerHour));
 
      await prisma.overtimeCharge.create({
        data: {
          reservationId,
          hoursOvertime: overtimeHours,
          ratePerHour: parking!.overtimeRatePerHour,
          totalCharge: overtimeCost,
          isPaid: false
        }
      });
    }
 
    const updated = await reservationRepository.update(reservationId, {
      status: ReservationStatus.COMPLETED,
      actualExitTime: now,
      overtimeHours,
      overtimeCost,
      totalCost: Number(reservation.baseCost) + overtimeCost,
      completedAt: now
    });
 
    if (reservation.parkingSpotId) {
      await prisma.parkingSpot.update({
        where: { id: reservation.parkingSpotId },
        data: { status: 'available' }
      });
    }
 
    await parkingRepository.updateAvailableSpots(reservation.parkingLotId, 1);
 
    if (overtimeCost > 0) {
      await notificationService.sendOvertimeCharged(
        reservation.userId,
        reservationId,
        overtimeCost,
        overtimeHours
      );
    }
 
    // ✅ NUEVO: Actualizar balance del propietario
    try {
      const parking = await parkingRepository.findById(reservation.parkingLotId);
      if (parking) {
        await balanceService.calculateOwnerBalance(parking.owner.id);
        logger.info(`Balance updated for owner ${parking.owner.id} after completing reservation ${reservationId}`);
      }
    } catch (error) {
      logger.error('Error updating owner balance:', error);
    }
 
    logger.info(`Check-out completed for reservation: ${reservationId}`);
    return updated;
  }


  /**
   * Pagar overtime
   */
  async payOvertime(reservationId: string, userEmail: string) {
    const overtimeCharge = await prisma.overtimeCharge.findUnique({
      where: { reservationId }
    });

    if (!overtimeCharge) throw new Error('No hay cargo de overtime para esta reserva');
    if (overtimeCharge.isPaid) throw new Error('El overtime ya fue pagado');

    const reservation = await reservationRepository.findById(reservationId);
    if (!reservation) throw new Error('Reserva no encontrada');

    const mpPayment = await mercadopagoService.createPayment({
      id: Date.now(),
      amount: Number(overtimeCharge.totalCharge),
      description: `Tiempo extra - Reserva ${reservation.reservationCode}`,
      payerEmail: userEmail,
      metadata: {
        reservationId,
        userId: reservation.userId,
        type: 'overtime'
      }
    });

    const payment = await paymentRepository.create({
      userId: reservation.userId,
      paymentType: PaymentType.OVERTIME,
      reservationId,
      amount: Number(overtimeCharge.totalCharge),
      commissionAmount: 0,
      netAmount: Number(overtimeCharge.totalCharge),
      paymentMethod: 'mercadopago',
      status: PaymentStatus.PENDING,
      transactionId: mpPayment.id
    });

    return {
      payment,
      paymentUrl: mpPayment.init_point,
      overtimeCharge
    };
  }

  /**
   * Cancelar reserva
   */
  async cancel(reservationId: string, userId: string, reason?: string) {
    const reservation = await reservationRepository.findById(reservationId);
    if (!reservation) throw new Error('Reserva no encontrada');

    if (reservation.userId !== userId) {
      throw new Error('No tienes permiso para cancelar esta reserva');
    }

    if (reservation.status === ReservationStatus.COMPLETED) {
      throw new Error('No se puede cancelar una reserva completada');
    }

    const updated = await reservationRepository.update(reservationId, {
      status: ReservationStatus.CANCELLED,
      cancelledAt: new Date(),
      cancellationReason: reason
    });

    if (reservation.parkingSpotId) {
      await prisma.parkingSpot.update({
        where: { id: reservation.parkingSpotId },
        data: { status: 'available' }
      });

      await parkingRepository.updateAvailableSpots(reservation.parkingLotId, 1);
    }

    const payment = await prisma.payment.findFirst({
      where: { reservationId, status: PaymentStatus.COMPLETED }
    });

    if (payment?.transactionId) {
      try {
        await mercadopagoService.refundPayment(payment.transactionId);
        await paymentRepository.update(payment.id, { status: PaymentStatus.REFUNDED });
        logger.info(`Refund processed for reservation: ${reservationId}`);
      } catch (error) {
        logger.error('Error processing refund:', error);
      }
    }

    logger.info(`Reservation cancelled: ${reservationId}`);
    return updated;
  }

  /**
   * Obtener reservas del usuario
   */
  async getUserReservations(userId: string, status?: ReservationStatus[]) {
    return await reservationRepository.findByUserId(userId, { status });
  }

  /**
   * Obtener reservas de un estacionamiento
   */
  async getParkingReservations(parkingLotId: string, filters?: any) {
    return await reservationRepository.findByParkingLotId(parkingLotId, filters);
  }

  /**
   * Obtener reserva por ID
   */
  async getById(reservationId: string) {
    return await reservationRepository.findById(reservationId);
  }

  /**
   * Verificar disponibilidad
   */
  async checkAvailability(parkingLotId: string, startTime: Date, endTime: Date) {
    const parking = await parkingRepository.findById(parkingLotId);
    if (!parking) throw new Error('Estacionamiento no encontrado');

    const overlappingReservations = await prisma.reservation.count({
      where: {
        parkingLotId,
        status: { in: [ReservationStatus.CONFIRMED, ReservationStatus.ACTIVE] },
        OR: [
          { AND: [{ startTime: { lte: startTime } }, { endTime: { gt: startTime } }] },
          { AND: [{ startTime: { lt: endTime } }, { endTime: { gte: endTime } }] },
          { AND: [{ startTime: { gte: startTime } }, { endTime: { lte: endTime } }] }
        ]
      }
    });

    const availableSpots = parking.totalSpots - overlappingReservations;

    return {
      available: availableSpots > 0,
      availableSpots,
      totalSpots: parking.totalSpots
    };
  }
}

export default new ReservationService();
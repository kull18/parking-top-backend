import prisma from '@/config/database';
import reservationRepository from '@/repositories/reservation.repository';
import parkingRepository from '@/repositories/parking.repository';
import paymentRepository from '@/repositories/payment.repository';
import { ReservationStatus, PaymentType, PaymentStatus } from '@/types/enums';
import { calculateHoursBetween, calculateCost, calculateCommission } from '@/utils/helpers';
import { stripeService } from '@/integrations/stripe.client';
import logger from '@/utils/logger';

export class ReservationService {
  
  async create(userId: string, data: {
    parkingLotId: string;
    vehicleId?: string;
    startTime: Date;
    endTime: Date;
    notes?: string;
  }) {
    try {
      // Obtener estacionamiento y plan
      const parking = await parkingRepository.findById(data.parkingLotId);
      if (!parking) {
        throw new Error('Estacionamiento no encontrado');
      }

      const subscription = await prisma.subscription.findUnique({
        where: { id: parking.subscriptionId! },
        include: { plan: true }
      });

      // Calcular costos
      const hours = calculateHoursBetween(data.startTime, data.endTime);
      const baseCost = calculateCost(hours, Number(parking.basePricePerHour));
      const commissionRate = subscription?.plan.commissionRate || 15;
      const commissionAmount = calculateCommission(baseCost, Number(commissionRate));

      // Crear reserva
      const reservation = await reservationRepository.create({
        userId,
        parkingLotId: data.parkingLotId,
        vehicleId: data.vehicleId,
        startTime: data.startTime,
        endTime: data.endTime,
        reservedHours: hours,
        baseCost,
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

  async processPayment(reservationId: string, paymentMethodId: string) {
    try {
      const reservation = await reservationRepository.findById(reservationId);
      if (!reservation) {
        throw new Error('Reserva no encontrada');
      }

      // Crear Payment Intent
      const paymentIntent = await stripeService.createPaymentIntent(
        Number(reservation.totalCost),
        {
          reservationId: reservation.id,
          userId: reservation.userId
        }
      );

      // Crear registro de pago
      const payment = await paymentRepository.create({
        userId: reservation.userId,
        paymentType: PaymentType.RESERVATION,
        reservationId: reservation.id,
        amount: Number(reservation.totalCost),
        commissionAmount: Number(reservation.commissionAmount),
        netAmount: Number(reservation.totalCost) - Number(reservation.commissionAmount),
        paymentMethod: 'card',
        status: PaymentStatus.PENDING,
        paymentIntentId: paymentIntent.id
      });

      return { reservation, payment, paymentIntent };
    } catch (error: any) {
      logger.error('Error processing payment:', error);
      throw error;
    }
  }

  async confirmReservation(reservationId: string) {
    try {
      const reservation = await reservationRepository.update(reservationId, {
        status: ReservationStatus.CONFIRMED
      });

      // Decrementar espacios disponibles
      await parkingRepository.updateAvailableSpots(reservation.parkingLotId, -1);

      // Asignar espacio si disponible
      const availableSpot = await prisma.parkingSpot.findFirst({
        where: {
          parkingLotId: reservation.parkingLotId,
          status: 'available'
        }
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

      // Crear notificación
      await prisma.notification.create({
        data: {
          userId: reservation.userId,
          type: 'reservation_confirmed',
          title: 'Reserva confirmada',
          message: `Tu reserva ${reservation.reservationCode} ha sido confirmada`,
          reservationId: reservation.id,
          isRead: false,
          isSent: false
        }
      });

      logger.info(`Reservation confirmed: ${reservationId}`);
      return reservation;
    } catch (error: any) {
      logger.error('Error confirming reservation:', error);
      throw error;
    }
  }

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

    return reservation;
  }

  async checkOut(reservationId: string) {
    const reservation = await reservationRepository.findById(reservationId);
    if (!reservation) {
      throw new Error('Reserva no encontrada');
    }

    const now = new Date();
    const overtimeHours = calculateHoursBetween(reservation.endTime, now);

    let overtimeCost = 0;
    if (overtimeHours > 0) {
      const parking = await parkingRepository.findById(reservation.parkingLotId);
      overtimeCost = calculateCost(overtimeHours, Number(parking!.overtimeRatePerHour));
    }

    const updated = await reservationRepository.update(reservationId, {
      status: ReservationStatus.COMPLETED,
      actualExitTime: now,
      overtimeHours,
      overtimeCost,
      totalCost: Number(reservation.baseCost) + overtimeCost,
      completedAt: now
    });

    // Liberar espacio
    if (reservation.parkingSpotId) {
      await prisma.parkingSpot.update({
        where: { id: reservation.parkingSpotId },
        data: { status: 'available' }
      });
    }

    await parkingRepository.updateAvailableSpots(reservation.parkingLotId, 1);

    return updated;
  }

  async cancel(reservationId: string, userId: string, reason?: string) {
    const reservation = await reservationRepository.findById(reservationId);
    if (!reservation) {
      throw new Error('Reserva no encontrada');
    }

    if (reservation.userId !== userId) {
      throw new Error('No tienes permiso para cancelar esta reserva');
    }

    const updated = await reservationRepository.update(reservationId, {
      status: ReservationStatus.CANCELLED,
      cancelledAt: new Date(),
      cancellationReason: reason
    });

    // Liberar espacio si estaba asignado
    if (reservation.parkingSpotId) {
      await prisma.parkingSpot.update({
        where: { id: reservation.parkingSpotId },
        data: { status: 'available' }
      });
    }

    await parkingRepository.updateAvailableSpots(reservation.parkingLotId, 1);

    return updated;
  }

  async getUserReservations(userId: string, status?: ReservationStatus[]) {
    return await reservationRepository.findByUserId(userId, { status });
  }

  async getParkingReservations(parkingLotId: string, filters?: any) {
    return await reservationRepository.findByParkingLotId(parkingLotId, filters);
  }
}

export default new ReservationService();
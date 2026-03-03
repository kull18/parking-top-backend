import overtimeRepository from '@/repositories/overtime.repository';
import reservationRepository from '@/repositories/reservation.repository';
import paymentRepository from '@/repositories/payment.repository';
import notificationService from './notification.service';
import { ReservationStatus, PaymentType, PaymentStatus, NotificationType } from '@/types/enums';
import { calculateHoursBetween, calculateCost, calculateCommission } from '@/utils/helpers';
import mercadopagoService from '@/integrations/mercadopago.client';
import logger from '@/utils/logger';
import dayjs from 'dayjs';
import prisma from '@/config/database';

// Tipo para overtime con relaciones
type OvertimeChargeWithRelations = Awaited<ReturnType<typeof overtimeRepository.findByParkingLotAndDateRange>>[0];

export class OvertimeService {
  
  /**
   * Verificar y calcular overtime de una reserva
   */
  async checkReservationOvertime(reservationId: string) {
    try {
      const reservation = await reservationRepository.findById(reservationId);

      if (!reservation || reservation.status !== ReservationStatus.ACTIVE) {
        return null;
      }

      const now = new Date();
      const gracePeriodEnd = dayjs(reservation.endTime)
        .add(15, 'minute')
        .toDate();

      // Si aún está en período de gracia, no hacer nada
      if (now <= gracePeriodEnd) {
        return null;
      }

      // Calcular overtime
      const overtimeHours = calculateHoursBetween(reservation.endTime, now);
      const overtimeCost = calculateCost(
        overtimeHours,
        Number(reservation.parkingLot.overtimeRatePerHour)
      );

      // Verificar si ya existe cargo de overtime
      const existingCharge = await overtimeRepository.findByReservationId(reservationId);

      if (existingCharge) {
        // Actualizar cargo existente
        return await overtimeRepository.update(existingCharge.id, {
          hoursOvertime: overtimeHours,
          totalCharge: overtimeCost
        });
      }

      // Crear nuevo cargo de overtime
      const overtimeCharge = await overtimeRepository.create({
        reservationId,
        hoursOvertime: overtimeHours,
        ratePerHour: Number(reservation.parkingLot.overtimeRatePerHour),
        totalCharge: overtimeCost,
        isPaid: false
      });

      // Intentar cobro automático
      await this.chargeOvertime(reservation.id, overtimeCharge.id);

      // Notificar al usuario
      await notificationService.create({
        userId: reservation.userId,
        type: NotificationType.OVERTIME_WARNING,
        title: 'Tiempo extra detectado',
        message: `Has excedido tu tiempo de reserva. Cargo adicional: $${overtimeCost} MXN`,
        reservationId: reservation.id
      });

      logger.info(`Overtime detected for reservation ${reservationId}: ${overtimeHours}h, $${overtimeCost}`);

      return overtimeCharge;
    } catch (error) {
      logger.error('Error checking reservation overtime:', error);
      throw error;
    }
  }

  /**
   * Crear cargo de overtime con MercadoPago
   */
  async chargeOvertime(reservationId: string, overtimeChargeId: string) {
    try {
      const reservation = await reservationRepository.findById(reservationId);
      const overtimeCharge = await overtimeRepository.findById(overtimeChargeId);

      if (!reservation || !overtimeCharge || overtimeCharge.isPaid) {
        return;
      }

      const commissionAmount = calculateCommission(
        Number(overtimeCharge.totalCharge),
        Number(reservation.commissionRate)
      );

      // Crear pago en MercadoPago
      const mpPayment = await mercadopagoService.createPayment({
        id: parseInt(overtimeChargeId.slice(-8), 16), // Convertir parte del ID a número
        amount: Number(overtimeCharge.totalCharge),
        description: `Cargo por tiempo extra - Reserva ${reservation.reservationCode}`,
        payerEmail: reservation.user.email,
        metadata: {
          reservationId,
          overtimeChargeId,
          userId: reservation.userId,
          type: 'overtime'
        }
      });

      // Crear registro de pago
      await paymentRepository.create({
        userId: reservation.userId,
        paymentType: PaymentType.OVERTIME,
        reservationId,
        amount: Number(overtimeCharge.totalCharge),
        commissionAmount,
        netAmount: Number(overtimeCharge.totalCharge) - commissionAmount,
        paymentMethod: 'mercadopago',
        status: PaymentStatus.PENDING,
        transactionId: mpPayment.id
      });

      logger.info(`Overtime charge created for reservation ${reservationId}`);

      return {
        paymentId: mpPayment.id,
        paymentUrl: mpPayment.init_point
      };
    } catch (error) {
      logger.error('Error charging overtime:', error);
      throw error;
    }
  }

  /**
   * Marcar overtime como pagado
   */
  async markOvertimeAsPaid(overtimeChargeId: string, userId?: string) {
    try {
      const overtimeCharge = await overtimeRepository.findById(overtimeChargeId);

      if (!overtimeCharge) {
        throw new Error('Cargo de overtime no encontrado');
      }

      // Verificar permisos si se proporciona userId
      if (userId && overtimeCharge.reservation.userId !== userId) {
        throw new Error('No tienes permiso para marcar este cargo como pagado');
      }

      const updated = await overtimeRepository.markAsPaid(overtimeChargeId);

      // Notificar al usuario
      await notificationService.sendOvertimeCharged(
        overtimeCharge.reservation.userId,
        overtimeCharge.reservationId,
        Number(overtimeCharge.totalCharge),
        Number(overtimeCharge.hoursOvertime)
      );

      logger.info(`Overtime charge ${overtimeChargeId} marked as paid`);

      return updated;
    } catch (error) {
      logger.error('Error marking overtime as paid:', error);
      throw error;
    }
  }

  /**
   * Liberar espacio automáticamente después de 6 horas de overtime
   */
  async autoReleaseOvertime(reservationId: string) {
    try {
      const reservation = await reservationRepository.findById(reservationId);

      if (!reservation || reservation.status !== ReservationStatus.ACTIVE) {
        return null;
      }

      const overtimeHours = calculateHoursBetween(
        reservation.endTime,
        new Date()
      );

      // Si lleva más de 6 horas de overtime, liberar automáticamente
      if (overtimeHours >= 6) {
        // Actualizar reserva
        await reservationRepository.update(reservationId, {
          status: ReservationStatus.COMPLETED,
          actualExitTime: new Date(),
          overtimeHours,
          completedAt: new Date()
        });

        // Liberar espacio
        if (reservation.parkingSpotId) {
          await prisma.parkingSpot.update({
            where: { id: reservation.parkingSpotId },
            data: { status: 'available' }
          });
        }

        await prisma.parkingLot.update({
          where: { id: reservation.parkingLotId },
          data: {
            availableSpots: { increment: 1 }
          }
        });

        // Notificar al usuario
        await notificationService.create({
          userId: reservation.userId,
          type: NotificationType.GENERAL,
          title: 'Espacio liberado automáticamente',
          message: `Tu reserva ha sido completada automáticamente después de ${overtimeHours.toFixed(1)} horas de tiempo extra.`,
          reservationId: reservation.id
        });

        logger.info(`Auto-released spot for reservation ${reservationId} after ${overtimeHours}h overtime`);

        return {
          released: true,
          overtimeHours,
          reservationId
        };
      }

      return {
        released: false,
        overtimeHours,
        reservationId
      };
    } catch (error) {
      logger.error('Error auto-releasing overtime:', error);
      throw error;
    }
  }

  /**
   * Obtener reporte de overtime de un estacionamiento
   */
  async getOvertimeReport(parkingLotId: string, startDate: Date, endDate: Date) {
    try {
      const overtimeCharges = await overtimeRepository.findByParkingLotAndDateRange(
        parkingLotId,
        startDate,
        endDate
      );

      const totalOvertimeRevenue = overtimeCharges.reduce(
        (sum: number, charge: OvertimeChargeWithRelations) => sum + Number(charge.totalCharge),
        0
      );

      const totalOvertimeHours = overtimeCharges.reduce(
        (sum: number, charge: OvertimeChargeWithRelations) => sum + Number(charge.hoursOvertime),
        0
      );

      const paidCharges = overtimeCharges.filter((c: OvertimeChargeWithRelations) => c.isPaid);
      const unpaidCharges = overtimeCharges.filter((c: OvertimeChargeWithRelations) => !c.isPaid);

      const paidRevenue = paidCharges.reduce(
        (sum: number, charge: OvertimeChargeWithRelations) => sum + Number(charge.totalCharge),
        0
      );

      const unpaidRevenue = unpaidCharges.reduce(
        (sum: number, charge: OvertimeChargeWithRelations) => sum + Number(charge.totalCharge),
        0
      );

      return {
        overtimeCharges,
        summary: {
          totalCharges: overtimeCharges.length,
          totalOvertimeRevenue,
          totalOvertimeHours,
          averageOvertimePerReservation: overtimeCharges.length > 0
            ? totalOvertimeHours / overtimeCharges.length
            : 0,
          averageRevenuePerCharge: overtimeCharges.length > 0
            ? totalOvertimeRevenue / overtimeCharges.length
            : 0,
          paidCharges: paidCharges.length,
          unpaidCharges: unpaidCharges.length,
          paidRevenue,
          unpaidRevenue
        }
      };
    } catch (error) {
      logger.error('Error getting overtime report:', error);
      throw error;
    }
  }

  /**
   * Obtener estadísticas de overtime por propietario
   */
  async getOwnerOvertimeStats(ownerId: string, startDate?: Date, endDate?: Date) {
    try {
      return await overtimeRepository.getStatsByOwner(ownerId, startDate, endDate);
    } catch (error) {
      logger.error('Error getting owner overtime stats:', error);
      throw error;
    }
  }

  /**
   * Obtener overtimes de un usuario
   */
  async getUserOvertimes(userId: string) {
    try {
      return await overtimeRepository.findByUserId(userId);
    } catch (error) {
      logger.error('Error getting user overtimes:', error);
      throw error;
    }
  }

  /**
   * Obtener overtime por ID
   */
  async getById(overtimeChargeId: string) {
    try {
      return await overtimeRepository.findById(overtimeChargeId);
    } catch (error) {
      logger.error('Error getting overtime by id:', error);
      throw error;
    }
  }

  /**
   * Obtener todos los overtimes no pagados
   */
  async getUnpaidOvertimes() {
    try {
      return await overtimeRepository.findUnpaidOvertimes();
    } catch (error) {
      logger.error('Error getting unpaid overtimes:', error);
      throw error;
    }
  }

  /**
   * Recordar a usuarios con overtimes no pagados (para cron job)
   */
  async sendUnpaidOvertimeReminders() {
    try {
      const unpaidOvertimes = await overtimeRepository.findUnpaidOvertimes();

      let remindersSent = 0;

      for (const overtime of unpaidOvertimes) {
        // Solo enviar recordatorio si el overtime tiene más de 1 hora
        const hoursSinceCreated = calculateHoursBetween(
          overtime.createdAt,
          new Date()
        );

        if (hoursSinceCreated >= 1) {
          await notificationService.create({
            userId: overtime.reservation.userId,
            type: NotificationType.PAYMENT_FAILED,
            title: 'Recordatorio: Pago pendiente',
            message: `Tienes un cargo pendiente de $${overtime.totalCharge} MXN por tiempo extra en ${overtime.reservation.parkingLot.name}`,
            reservationId: overtime.reservationId
          });

          remindersSent++;
        }
      }

      logger.info(`Sent ${remindersSent} unpaid overtime reminders`);

      return {
        totalUnpaid: unpaidOvertimes.length,
        remindersSent
      };
    } catch (error) {
      logger.error('Error sending unpaid overtime reminders:', error);
      throw error;
    }
  }

  /**
   * Procesar auto-liberación de espacios con overtime excesivo (para cron job)
   */
  async processAutoReleases() {
    try {
      const activeReservations = await prisma.reservation.findMany({
        where: {
          status: ReservationStatus.ACTIVE
        }
      });

      let releasedCount = 0;

      for (const reservation of activeReservations) {
        const result = await this.autoReleaseOvertime(reservation.id);
        if (result?.released) {
          releasedCount++;
        }
      }

      logger.info(`Auto-released ${releasedCount} spots with excessive overtime`);

      return {
        checked: activeReservations.length,
        released: releasedCount
      };
    } catch (error) {
      logger.error('Error processing auto releases:', error);
      throw error;
    }
  }

  /**
   * Calcular ingresos totales por overtime de un estacionamiento
   */
  async getTotalRevenue(parkingLotId: string, startDate?: Date, endDate?: Date) {
    try {
      return await overtimeRepository.getTotalRevenueByParkingLot(
        parkingLotId,
        startDate,
        endDate
      );
    } catch (error) {
      logger.error('Error getting total overtime revenue:', error);
      throw error;
    }
  }
}

export default new OvertimeService();
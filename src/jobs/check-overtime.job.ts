import cron from 'node-cron';
import prisma from '@/config/database';
import { ReservationStatus, PaymentType, PaymentStatus } from '@/types/enums';
import { calculateHoursBetween, calculateCost, calculateCommission } from '@/utils/helpers';
import { stripeService } from '@/integrations/stripe.client';
import firebaseService from '@/integrations/firebase.client';
import logger from '@/utils/logger';
import dayjs from 'dayjs';

export const checkOvertimeJob = cron.schedule('*/5 * * * *', async () => {
  try {
    logger.info('Running overtime check job...');

    const now = new Date();
    const gracePeriodEnd = dayjs(now).subtract(15, 'minute').toDate();

    // Buscar reservas activas con overtime
    const overdueReservations = await prisma.reservation.findMany({
      where: {
        status: ReservationStatus.ACTIVE,
        endTime: { lt: gracePeriodEnd }
      },
      include: {
        user: true,
        parkingLot: true
      }
    });

    for (const reservation of overdueReservations) {
      const overtimeHours = calculateHoursBetween(reservation.endTime, now);
      const overtimeCost = calculateCost(
        overtimeHours,
        Number(reservation.parkingLot.overtimeRatePerHour)
      );

      // Verificar si ya tiene cargo de overtime
      const existingCharge = await prisma.overtimeCharge.findFirst({
        where: { reservationId: reservation.id }
      });

      if (!existingCharge) {
        // Crear cargo de overtime
        const overtimeCharge = await prisma.overtimeCharge.create({
          data: {
            reservationId: reservation.id,
            hoursOvertime: overtimeHours,
            ratePerHour: Number(reservation.parkingLot.overtimeRatePerHour),
            totalCharge: overtimeCost,
            isPaid: false
          }
        });

        // Intentar cobro automático
        try {
          const commissionAmount = calculateCommission(
            overtimeCost,
            Number(reservation.commissionRate)
          );

          const paymentIntent = await stripeService.createPaymentIntent(
            overtimeCost,
            {
              reservationId: reservation.id,
              overtimeChargeId: overtimeCharge.id,
              userId: reservation.userId
            }
          );

          await prisma.payment.create({
            data: {
              userId: reservation.userId,
              paymentType: PaymentType.OVERTIME,
              reservationId: reservation.id,
              amount: overtimeCost,
              commissionAmount,
              netAmount: overtimeCost - commissionAmount,
              paymentMethod: 'card',
              status: PaymentStatus.PENDING,
              paymentIntentId: paymentIntent.id
            }
          });

          // Notificar al usuario
          await prisma.notification.create({
            data: {
              userId: reservation.userId,
              type: 'overtime_charged',
              title: 'Cargo por tiempo extra',
              message: `Se ha cobrado $${overtimeCost} MXN por ${overtimeHours.toFixed(
                2
              )} horas de tiempo extra`,
              reservationId: reservation.id,
              isRead: false,
              isSent: false
            }
          });

          await firebaseService.sendToUser(reservation.userId, {
            title: 'Tiempo extra',
            body: `Has excedido tu tiempo de reserva. Cargo: $${overtimeCost} MXN`
          });
        } catch (error) {
          logger.error(`Error charging overtime for reservation ${reservation.id}:`, error);
        }
      }

      // Si lleva más de 6 horas de overtime, liberar espacio
      if (overtimeHours >= 6) {
        await prisma.reservation.update({
          where: { id: reservation.id },
          data: {
            status: ReservationStatus.COMPLETED,
            actualExitTime: now,
            overtimeHours,
            overtimeCost,
            completedAt: now
          }
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
            availableSpots: {
              increment: 1
            }
          }
        });

        logger.info(`Released spot for reservation ${reservation.id} after 6 hours overtime`);
      }
    }

    logger.info(`Processed ${overdueReservations.length} overdue reservations`);
  } catch (error) {
    logger.error('Error in overtime check job:', error);
  }
}, {
  scheduled: false
});

export const startOvertimeJob = (): void => {
  checkOvertimeJob.start();
  logger.info('Overtime check job started');
};

export const stopOvertimeJob = (): void => {
  checkOvertimeJob.stop();
  logger.info('Overtime check job stopped');
};
import cron from 'node-cron';
import prisma from '@/config/database';
import { ReservationStatus, NotificationType } from '@/types/enums';
import firebaseService from '@/integrations/firebase.client';
import logger from '@/utils/logger';
import dayjs from 'dayjs';

export const sendRemindersJob = cron.schedule('*/15 * * * *', async () => {
  try {
    logger.info('Running reminders job...');

    const now = new Date();
    const in30Minutes = dayjs(now).add(30, 'minute').toDate();
    const buffer = dayjs(now).add(5, 'minute').toDate();

    // Recordatorios de inicio (30 min antes)
    const upcomingReservations = await prisma.reservation.findMany({
      where: {
        status: ReservationStatus.CONFIRMED,
        startTime: {
          gte: now,
          lte: in30Minutes
        }
      },
      include: {
        user: true,
        parkingLot: true
      }
    });

    for (const reservation of upcomingReservations) {
      // Verificar si ya se envió recordatorio
      const existingNotification = await prisma.notification.findFirst({
        where: {
          reservationId: reservation.id,
          type: NotificationType.RESERVATION_REMINDER
        }
      });

      if (!existingNotification) {
        await prisma.notification.create({
          data: {
            userId: reservation.userId,
            type: NotificationType.RESERVATION_REMINDER,
            title: 'Tu reserva inicia pronto',
            message: `Tu reserva en ${reservation.parkingLot.name} inicia en 30 minutos`,
            reservationId: reservation.id,
            isRead: false,
            isSent: false
          }
        });

        await firebaseService.sendToUser(reservation.userId, {
          title: 'Reserva próxima',
          body: `Tu estacionamiento en ${reservation.parkingLot.name} inicia en 30 minutos`,
          data: {
            reservationId: reservation.id,
            type: 'reservation_reminder'
          }
        });

        logger.info(`Sent start reminder for reservation ${reservation.id}`);
      }
    }

    // Recordatorios de fin (30 min antes de finalizar)
    const endingSoonReservations = await prisma.reservation.findMany({
      where: {
        status: ReservationStatus.ACTIVE,
        endTime: {
          gte: now,
          lte: in30Minutes
        }
      },
      include: {
        user: true,
        parkingLot: true
      }
    });

    for (const reservation of endingSoonReservations) {
      const existingNotification = await prisma.notification.findFirst({
        where: {
          reservationId: reservation.id,
          type: NotificationType.OVERTIME_WARNING
        }
      });

      if (!existingNotification) {
        await prisma.notification.create({
          data: {
            userId: reservation.userId,
            type: NotificationType.OVERTIME_WARNING,
            title: 'Tu reserva termina pronto',
            message: `Tu reserva termina en 30 minutos. Recuerda hacer check-out a tiempo`,
            reservationId: reservation.id,
            isRead: false,
            isSent: false
          }
        });

        await firebaseService.sendToUser(reservation.userId, {
          title: 'Reserva terminando',
          body: 'Tu tiempo de estacionamiento termina en 30 minutos',
          data: {
            reservationId: reservation.id,
            type: 'ending_soon'
          }
        });

        logger.info(`Sent end reminder for reservation ${reservation.id}`);
      }
    }

    logger.info(
      `Sent ${upcomingReservations.length} start reminders and ${endingSoonReservations.length} end reminders`
    );
  } catch (error) {
    logger.error('Error in reminders job:', error);
  }
}, {
  scheduled: false
});

export const startRemindersJob = (): void => {
  sendRemindersJob.start();
  logger.info('Reminders job started');
};

export const stopRemindersJob = (): void => {
  sendRemindersJob.stop();
  logger.info('Reminders job stopped');
};
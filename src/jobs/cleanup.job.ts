import cron from 'node-cron';
import prisma from '@/config/database';
import logger from '@/utils/logger';
import dayjs from 'dayjs';

// Ejecutar diariamente a las 02:00
export const cleanupOldDataJob = cron.schedule('0 2 * * *', async () => {
  try {
    logger.info('Running cleanup old data job...');

    const sixMonthsAgo = dayjs().subtract(6, 'month').toDate();
    const oneYearAgo = dayjs().subtract(1, 'year').toDate();

    // Limpiar notificaciones leídas de más de 6 meses
    const deletedNotifications = await prisma.notification.deleteMany({
      where: {
        isRead: true,
        readAt: {
          lt: sixMonthsAgo
        }
      }
    });

    logger.info(`Deleted ${deletedNotifications.count} old notifications`);

    // Limpiar reservas canceladas de más de 1 año
    const deletedReservations = await prisma.reservation.deleteMany({
      where: {
        status: 'cancelled',
        cancelledAt: {
          lt: oneYearAgo
        }
      }
    });

    logger.info(`Deleted ${deletedReservations.count} old cancelled reservations`);

    // Limpiar tokens de push inactivos de más de 6 meses
    const deletedTokens = await prisma.pushToken.deleteMany({
      where: {
        isActive: false,
        updatedAt: {
          lt: sixMonthsAgo
        }
      }
    });

    logger.info(`Deleted ${deletedTokens.count} inactive push tokens`);

    // Limpiar pagos fallidos de más de 3 meses
    const threeMonthsAgo = dayjs().subtract(3, 'month').toDate();
    const deletedPayments = await prisma.payment.deleteMany({
      where: {
        status: 'failed',
        createdAt: {
          lt: threeMonthsAgo
        }
      }
    });

    logger.info(`Deleted ${deletedPayments.count} old failed payments`);

    logger.info('Cleanup job completed successfully');
  } catch (error) {
    logger.error('Error in cleanup job:', error);
  }
}, {
  scheduled: false
});

export const startCleanupJob = (): void => {
  cleanupOldDataJob.start();
  logger.info('Cleanup job started');
};

export const stopCleanupJob = (): void => {
  cleanupOldDataJob.stop();
  logger.info('Cleanup job stopped');
};
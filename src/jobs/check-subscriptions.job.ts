import cron from 'node-cron';
import subscriptionService from '@/services/subscription.service';
import logger from '@/utils/logger';

// Ejecutar diariamente a las 00:00
export const checkSubscriptionsJob = cron.schedule('0 0 * * *', async () => {
  try {
    logger.info('Running subscription check job...');
    await subscriptionService.checkAndUpdateSubscriptions();
    logger.info('Subscription check job completed');
  } catch (error) {
    logger.error('Error in subscription check job:', error);
  }
}, {
  scheduled: false
});

// Enviar recordatorios a las 10:00
export const sendRemindersJob = cron.schedule('0 10 * * *', async () => {
  try {
    logger.info('Running subscription reminders job...');
    await subscriptionService.sendRenewalReminders();
    logger.info('Reminders job completed');
  } catch (error) {
    logger.error('Error in reminders job:', error);
  }
}, {
  scheduled: false
});

export const startSubscriptionJobs = (): void => {
  checkSubscriptionsJob.start();
  sendRemindersJob.start();
  logger.info('Subscription cron jobs started');
};

export const stopSubscriptionJobs = (): void => {
  checkSubscriptionsJob.stop();
  sendRemindersJob.stop();
  logger.info('Subscription cron jobs stopped');
};
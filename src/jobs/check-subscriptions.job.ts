import cron from 'node-cron';
import subscriptionService from '@/services/subscription.service.mercadopago';
import logger from '@/utils/logger';

// Verificar suscripciones expiradas - Ejecutar diariamente a las 00:00
export const checkSubscriptionsJob = cron.schedule('0 0 * * *', async () => {
  try {
    logger.info('Running subscription check job...');
    
    await subscriptionService.checkExpiredSubscriptions();
    
    logger.info('Subscription check job completed');
  } catch (error) {
    logger.error('Error in subscription check job:', error);
  }
}, {
  scheduled: false
});

// Enviar recordatorios de renovación - Ejecutar diariamente a las 10:00
export const sendRemindersJob = cron.schedule('0 10 * * *', async () => {
  try {
    logger.info('Running subscription reminders job...');
    
    await subscriptionService.sendRenewalReminders(3); // 3 días antes
    
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
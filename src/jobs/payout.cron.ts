// src/cron/payout.cron.ts
import cron from 'node-cron';
import balanceService from '@/services/balance.service';
import payoutService from '@/services/payout.service';
import logger from '@/utils/logger';

/**
 * Recalcular balances de todos los propietarios
 * Ejecuta diariamente a las 2:00 AM
 */
export const recalculateBalancesJob = cron.schedule(
  '0 2 * * *',
  async () => {
    try {
      logger.info('Running balance recalculation job...');
      
      const result = await balanceService.recalculateAllBalances();
      
      logger.info(`Balance recalculation completed: ${result.ownersProcessed} owners processed`);
    } catch (error) {
      logger.error('Error in balance recalculation job:', error);
    }
  },
  {
    scheduled: false,
    timezone: 'America/Mexico_City'
  }
);

/**
 * Procesar payouts aprobados
 * Ejecuta cada hora
 */
export const processPayoutsJob = cron.schedule(
  '0 * * * *',
  async () => {
    try {
      logger.info('Running payout processing job...');
      
      const result = await payoutService.processApprovedPayouts();
      
      logger.info(`Payout processing completed: ${result.processed} payouts processed`);
    } catch (error) {
      logger.error('Error in payout processing job:', error);
    }
  },
  {
    scheduled: false,
    timezone: 'America/Mexico_City'
  }
);

/**
 * Iniciar todos los cron jobs de payouts
 */
export const startPayoutCronJobs = () => {
  recalculateBalancesJob.start();
  processPayoutsJob.start();
  
  logger.info('Payout cron jobs started');
};

/**
 * Detener todos los cron jobs de payouts
 */
export const stopPayoutCronJobs = () => {
  recalculateBalancesJob.stop();
  processPayoutsJob.stop();
  
  logger.info('Payout cron jobs stopped');
};
import cron from 'node-cron';
import overtimeService from '@/services/overtime.service';
import logger from '@/utils/logger';

// Verificar overtime cada 5 minutos
export const checkOvertimeJob = cron.schedule('*/5 * * * *', async () => {
  try {
    logger.info('Running overtime check job...');
    
    await overtimeService.processAutoReleases();
    
    logger.info('Overtime check job completed');
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
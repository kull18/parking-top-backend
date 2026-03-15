// src/jobs/index.ts
import { config } from '@/config/environment';
import logger from '@/utils/logger';

// Import all job modules
import { startOvertimeJob, stopOvertimeJob } from './check-overtime.job';
import { startSubscriptionJobs, stopSubscriptionJobs } from './check-subscriptions.job';
import { startRemindersJob, stopRemindersJob } from './send-reminders.job';
import { startCleanupJob, stopCleanupJob } from './cleanup.job';

/**
 * Initialize and start all cron jobs
 */
export const startAllJobs = (): void => {
  if (config.app.env === 'production' || config.app.enableCronJobs) {
    logger.info('🕐 Starting cron jobs...');

    // Start overtime check job (every 5 minutes)
    startOvertimeJob();

    // Start subscription jobs (daily)
    startSubscriptionJobs();

    // Start reminders job (every 15 minutes)
    startRemindersJob();

    // Start cleanup job (daily at 2 AM)
    startCleanupJob();

    logger.info('✅ All cron jobs started successfully');
  } else {
    logger.info('⏸️  Cron jobs disabled in development mode');
  }
};

/**
 * Stop all running cron jobs
 */
export const stopAllJobs = (): void => {
  logger.info('⏹️  Stopping all cron jobs...');

  stopOvertimeJob();
  stopSubscriptionJobs();
  stopRemindersJob();
  stopCleanupJob();

  logger.info('✅ All cron jobs stopped');
};

/**
 * Get status of all jobs
 */
export const getJobsStatus = () => {
  return {
    overtimeCheck: {
      schedule: '*/5 * * * *',
      description: 'Check and process overtime charges',
      interval: 'Every 5 minutes'
    },
    subscriptionCheck: {
      schedule: '0 0 * * *',
      description: 'Check expired subscriptions',
      interval: 'Daily at 00:00'
    },
    subscriptionReminders: {
      schedule: '0 10 * * *',
      description: 'Send renewal reminders',
      interval: 'Daily at 10:00'
    },
    reservationReminders: {
      schedule: '*/15 * * * *',
      description: 'Send reservation reminders',
      interval: 'Every 15 minutes'
    },
    cleanup: {
      schedule: '0 2 * * *',
      description: 'Clean up old data',
      interval: 'Daily at 02:00'
    }
  };
};

export default {
  startAllJobs,
  stopAllJobs,
  getJobsStatus
};
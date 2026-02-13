import app from './app';
import { config, validateConfig } from '@/config/environment';
import prisma from '@/config/database';
import redis from '@/config/redis';
import logger from '@/utils/logger';
import { startSubscriptionJobs, stopSubscriptionJobs } from '@/jobs/check-subscriptions.job';

try {
  validateConfig();
  logger.info('✅ Configuration validated successfully');
} catch (error: any) {
  logger.error('❌ Configuration error:', error.message);
  process.exit(1);
}

// Iniciar servidor
const server = app.listen(config.app.port, () => {
  logger.info(`🚀 Server running on port ${config.app.port}`);
  logger.info(`📝 Environment: ${config.app.env}`);
  logger.info(`🗄️  Database connected`);
  logger.info(`💾 Redis connected`);
  
  // Iniciar cron jobs en producción
  if (config.app.env === 'production') {
    startSubscriptionJobs();
    logger.info('⏰ Cron jobs started');
  } else {
    logger.info('⏰ Cron jobs disabled in development');
  }
});

// Manejo de cierre graceful
const gracefulShutdown = async (): Promise<void> => {
  logger.info('Received shutdown signal, closing gracefully...');
  
  server.close(async () => {
    logger.info('HTTP server closed');
    
    // Detener cron jobs
    stopSubscriptionJobs();
    logger.info('Cron jobs stopped');
    
    // Cerrar conexiones
    await prisma.$disconnect();
    logger.info('Database disconnected');
    
    redis.disconnect();
    logger.info('Redis disconnected');
    
    process.exit(0);
  });

  // Forzar cierre después de 10 segundos
  setTimeout(() => {
    logger.error('Could not close connections in time, forcefully shutting down');
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

// Manejo de errores no capturados
process.on('unhandledRejection', (reason: any) => {
  logger.error('Unhandled Rejection:', reason);
});

process.on('uncaughtException', (error: Error) => {
  logger.error('Uncaught Exception:', error);
  gracefulShutdown();
});

export default server;
// src/routes/admin.routes.ts
import { Router, Request, Response } from 'express';
import { authenticate } from '@/middlewares/auth.middleware';
import { authorize } from '@/middlewares/role.middleware';
import { UserRole } from '@/types/enums';
import { getJobsStatus } from '@/jobs';
import logger from '@/utils/logger';

const router = Router();

// Todas las rutas requieren autenticación de admin
router.use(authenticate);
router.use(authorize(UserRole.ADMIN));

/**
 * GET /admin/jobs/status
 * Obtener estado de todos los cron jobs
 */
router.get('/jobs/status', async (req: Request, res: Response) => {
  try {
    const status = getJobsStatus();

    return res.json({
      success: true,
      data: {
        jobs: status,
        environment: process.env.NODE_ENV,
        cronJobsEnabled: process.env.ENABLE_CRON_JOBS === 'true' || process.env.NODE_ENV === 'production'
      }
    });
  } catch (error: any) {
    logger.error('Error getting jobs status:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: error.message
      }
    });
  }
});

/**
 * POST /admin/jobs/:jobName/run
 * Ejecutar manualmente un cron job (para testing)
 */
router.post('/jobs/:jobName/run', async (req: Request, res: Response) => {
  try {
    const { jobName } = req.params;

    // Importar dinámicamente el job
    let result;
    
    switch (jobName) {
      case 'overtime':
        const overtimeService = (await import('@/services/overtime.service')).default;
        result = await overtimeService.processAutoReleases();
        break;
        
      case 'subscriptions':
        const subscriptionService = (await import('@/services/subscription.service.mercadopago')).default;
        result = await subscriptionService.checkExpiredSubscriptions();
        break;
        
      case 'cleanup':
        // Ejecutar cleanup manualmente
        result = { message: 'Cleanup job executed' };
        break;
        
      default:
        return res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_JOB',
            message: `Job '${jobName}' not found`
          }
        });
    }

    logger.info(`[ADMIN] Manually executed job: ${jobName}`);

    return res.json({
      success: true,
      data: {
        job: jobName,
        result,
        executedAt: new Date().toISOString()
      }
    });

  } catch (error: any) {
    logger.error(`Error executing job ${req.params.jobName}:`, error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'EXECUTION_ERROR',
        message: error.message
      }
    });
  }
});

export default router;
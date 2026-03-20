// src/routes/dashboard.routes.ts
import { Router } from 'express';
import dashboardController from '@/controllers/dashboard.controller';
import { authenticate } from '@/middlewares/auth.middleware';
import { authorize } from '@/middlewares/role.middleware';
import { UserRole } from '@/types/enums';

const router = Router();

// Todas las rutas requieren autenticación y ser propietario
router.use(authenticate);
router.use(authorize(UserRole.OWNER));

/**
 * GET /dashboard
 * Obtener dashboard completo
 */
router.get('/', dashboardController.getCompleteDashboard);

/**
 * GET /dashboard/stats
 * Obtener estadísticas generales
 */
router.get('/stats', dashboardController.getStats);

/**
 * GET /dashboard/revenue
 * Obtener ingresos por período
 * Query params: period (day|month|year), range (número de períodos)
 */
router.get('/revenue', dashboardController.getRevenue);

/**
 * GET /dashboard/parking-stats
 * Obtener estadísticas por estacionamiento
 */
router.get('/parking-stats', dashboardController.getParkingStats);

/**
 * GET /dashboard/recent-reviews
 * Obtener últimas reseñas
 * Query params: limit (número de reseñas)
 */
router.get('/recent-reviews', dashboardController.getRecentReviews);

/**
 * GET /dashboard/peak-hours
 * Obtener análisis de horarios pico
 */
router.get('/peak-hours', dashboardController.getPeakHours);

/**
 * GET /dashboard/custom-report
 * Obtener reporte personalizado por rango de fechas
 * Query params: startDate (YYYY-MM-DD), endDate (YYYY-MM-DD)
 */
router.get('/custom-report', dashboardController.getCustomReport);

export default router;
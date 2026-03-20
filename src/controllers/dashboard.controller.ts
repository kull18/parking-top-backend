// src/controllers/dashboard.controller.ts
import { Response, NextFunction } from 'express';
import { AuthRequest } from '@/types/interfaces';
import dashboardService from '@/services/dashboard.service';
import { sendSuccess, sendError } from '@/utils/response';
import logger from '@/utils/logger';
import { UserRole } from '@/types/enums';

export class DashboardController {

  /**
   * Obtener estadísticas generales
   * GET /dashboard/stats
   */
  async getStats(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const role = req.user!.role;

      // Verificar que sea propietario
      if (role !== UserRole.OWNER) {
        sendError(res, 'FORBIDDEN', 'Solo los propietarios pueden acceder al dashboard', 403);
        return;
      }

      const stats = await dashboardService.getOwnerStats(userId);

      sendSuccess(res, stats);
    } catch (error) {
      logger.error('Error getting dashboard stats:', error);
      next(error);
    }
  }

  /**
   * Obtener ingresos por período
   * GET /dashboard/revenue?period=month&range=12
   */
  async getRevenue(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const role = req.user!.role;
      const { period = 'month', range } = req.query;

      if (role !== UserRole.OWNER) {
        sendError(res, 'FORBIDDEN', 'Solo los propietarios pueden acceder al dashboard', 403);
        return;
      }

      const validPeriods = ['day', 'month', 'year'];
      if (!validPeriods.includes(period as string)) {
        sendError(res, 'INVALID_PERIOD', 'Período inválido. Use: day, month, year', 400);
        return;
      }

      const revenue = await dashboardService.getRevenue(
        userId,
        period as 'day' | 'month' | 'year',
        range ? parseInt(range as string) : undefined
      );

      sendSuccess(res, revenue);
    } catch (error) {
      logger.error('Error getting revenue:', error);
      next(error);
    }
  }

  /**
   * Obtener estadísticas por estacionamiento
   * GET /dashboard/parking-stats
   */
  async getParkingStats(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const role = req.user!.role;

      if (role !== UserRole.OWNER) {
        sendError(res, 'FORBIDDEN', 'Solo los propietarios pueden acceder al dashboard', 403);
        return;
      }

      const stats = await dashboardService.getParkingLotStats(userId);

      sendSuccess(res, stats);
    } catch (error) {
      logger.error('Error getting parking stats:', error);
      next(error);
    }
  }

  /**
   * Obtener últimas reseñas
   * GET /dashboard/recent-reviews?limit=10
   */
  async getRecentReviews(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const role = req.user!.role;
      const { limit = 10 } = req.query;

      if (role !== UserRole.OWNER) {
        sendError(res, 'FORBIDDEN', 'Solo los propietarios pueden acceder al dashboard', 403);
        return;
      }

      const reviews = await dashboardService.getRecentReviews(
        userId,
        parseInt(limit as string)
      );

      sendSuccess(res, reviews);
    } catch (error) {
      logger.error('Error getting recent reviews:', error);
      next(error);
    }
  }

  /**
   * Obtener análisis de horarios pico
   * GET /dashboard/peak-hours
   */
  async getPeakHours(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const role = req.user!.role;

      if (role !== UserRole.OWNER) {
        sendError(res, 'FORBIDDEN', 'Solo los propietarios pueden acceder al dashboard', 403);
        return;
      }

      const peakHours = await dashboardService.getPeakHoursAnalysis(userId);

      sendSuccess(res, peakHours);
    } catch (error) {
      logger.error('Error getting peak hours:', error);
      next(error);
    }
  }

  /**
   * Obtener reporte personalizado
   * GET /dashboard/custom-report?startDate=2026-01-01&endDate=2026-12-31
   */
  async getCustomReport(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const role = req.user!.role;
      const { startDate, endDate } = req.query;

      if (role !== UserRole.OWNER) {
        sendError(res, 'FORBIDDEN', 'Solo los propietarios pueden acceder al dashboard', 403);
        return;
      }

      if (!startDate || !endDate) {
        sendError(res, 'MISSING_DATES', 'Debe proporcionar startDate y endDate', 400);
        return;
      }

      const start = new Date(startDate as string);
      const end = new Date(endDate as string);

      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        sendError(res, 'INVALID_DATES', 'Fechas inválidas', 400);
        return;
      }

      if (start > end) {
        sendError(res, 'INVALID_RANGE', 'La fecha de inicio debe ser anterior a la fecha de fin', 400);
        return;
      }

      const report = await dashboardService.getCustomReport(userId, start, end);

      sendSuccess(res, report);
    } catch (error) {
      logger.error('Error generating custom report:', error);
      next(error);
    }
  }

  /**
   * Obtener dashboard completo
   * GET /dashboard
   */
  async getCompleteDashboard(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const role = req.user!.role;

      if (role !== UserRole.OWNER) {
        sendError(res, 'FORBIDDEN', 'Solo los propietarios pueden acceder al dashboard', 403);
        return;
      }

      const dashboard = await dashboardService.getCompleteDashboard(userId);

      sendSuccess(res, dashboard);
    } catch (error) {
      logger.error('Error getting complete dashboard:', error);
      next(error);
    }
  }
}

export default new DashboardController();
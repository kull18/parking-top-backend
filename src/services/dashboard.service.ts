// src/services/dashboard.service.ts
import dashboardRepository from '@/repositories/dashboard.repository';
import logger from '@/utils/logger';

export class DashboardService {

  /**
   * Obtener estadísticas generales del propietario
   */
  async getOwnerStats(ownerId: string) {
    try {
      const stats = await dashboardRepository.getOwnerStats(ownerId);

      // Calcular tasa de ocupación promedio
      const occupancyRate = stats.totalParkingLots > 0
        ? ((stats.activeReservations / (stats.totalParkingLots * 10)) * 100).toFixed(2)
        : '0';

      return {
        ...stats,
        averageOccupancy: Number(occupancyRate),
        completionRate: stats.totalReservations > 0
          ? ((stats.completedReservations / stats.totalReservations) * 100).toFixed(2)
          : '0',
        cancellationRate: stats.totalReservations > 0
          ? ((stats.cancelledReservations / stats.totalReservations) * 100).toFixed(2)
          : '0'
      };
    } catch (error) {
      logger.error('Error getting owner stats:', error);
      throw error;
    }
  }

  /**
   * Obtener ingresos por período
   */
  async getRevenue(ownerId: string, period: 'day' | 'month' | 'year' = 'month', range?: number) {
    try {
      let revenueData;

      switch (period) {
        case 'day':
          revenueData = await dashboardRepository.getDailyRevenue(ownerId, range || 30);
          break;
        case 'month':
          revenueData = await dashboardRepository.getMonthlyRevenue(ownerId, range || 12);
          break;
        default:
          revenueData = await dashboardRepository.getMonthlyRevenue(ownerId, 12);
      }

      // Convertir a array ordenado
      const revenueArray = Object.entries(revenueData)
        .map(([period, amount]) => ({
          period,
          revenue: Number(amount.toFixed(2))
        }))
        .sort((a, b) => a.period.localeCompare(b.period));

      return {
        period,
        data: revenueArray,
        total: revenueArray.reduce((sum, item) => sum + item.revenue, 0)
      };
    } catch (error) {
      logger.error('Error getting revenue:', error);
      throw error;
    }
  }

  /**
   * Obtener estadísticas por estacionamiento
   */
  async getParkingLotStats(ownerId: string) {
    try {
      const stats = await dashboardRepository.getStatsByParkingLot(ownerId);

      return stats.sort((a, b) => b.totalRevenue - a.totalRevenue);
    } catch (error) {
      logger.error('Error getting parking lot stats:', error);
      throw error;
    }
  }

  /**
   * Obtener últimas reseñas
   */
  async getRecentReviews(ownerId: string, limit: number = 10) {
    try {
      return await dashboardRepository.getRecentReviews(ownerId, limit);
    } catch (error) {
      logger.error('Error getting recent reviews:', error);
      throw error;
    }
  }

  /**
   * Obtener análisis de horarios pico
   */
  async getPeakHoursAnalysis(ownerId: string) {
    try {
      const hourCounts = await dashboardRepository.getPeakHours(ownerId);

      // Convertir a array ordenado
      const hoursArray = Object.entries(hourCounts)
        .map(([hour, count]) => ({
          hour: parseInt(hour),
          hourLabel: `${hour.padStart(2, '0')}:00`,
          reservations: count
        }))
        .sort((a, b) => a.hour - b.hour);

      // Identificar top 3 horas pico
      const topHours = [...hoursArray]
        .sort((a, b) => b.reservations - a.reservations)
        .slice(0, 3);

      return {
        hourlyData: hoursArray,
        peakHours: topHours
      };
    } catch (error) {
      logger.error('Error getting peak hours:', error);
      throw error;
    }
  }

  /**
   * Obtener reporte personalizado por rango de fechas
   */
  async getCustomReport(ownerId: string, startDate: Date, endDate: Date) {
    try {
      const revenue = await dashboardRepository.getRevenueByDateRange(
        ownerId,
        startDate,
        endDate
      );

      const stats = await dashboardRepository.getOwnerStats(ownerId);

      return {
        period: {
          start: startDate.toISOString(),
          end: endDate.toISOString(),
          days: Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))
        },
        revenue: {
          total: revenue.totalRevenue,
          totalPayments: revenue.totalPayments,
          averagePerPayment: revenue.totalPayments > 0
            ? (revenue.totalRevenue / revenue.totalPayments).toFixed(2)
            : '0'
        },
        currentStats: {
          activeReservations: stats.activeReservations,
          activeParkingLots: stats.activeParkingLots
        }
      };
    } catch (error) {
      logger.error('Error generating custom report:', error);
      throw error;
    }
  }

  /**
   * Obtener dashboard completo
   */
  async getCompleteDashboard(ownerId: string) {
    try {
      const [
        stats,
        revenue,
        parkingStats,
        recentReviews,
        peakHours
      ] = await Promise.all([
        this.getOwnerStats(ownerId),
        this.getRevenue(ownerId, 'month', 6),
        this.getParkingLotStats(ownerId),
        this.getRecentReviews(ownerId, 5),
        this.getPeakHoursAnalysis(ownerId)
      ]);

      return {
        overview: stats,
        revenue,
        parkingLots: parkingStats,
        recentReviews,
        peakHours
      };
    } catch (error) {
      logger.error('Error getting complete dashboard:', error);
      throw error;
    }
  }
}

export default new DashboardService();
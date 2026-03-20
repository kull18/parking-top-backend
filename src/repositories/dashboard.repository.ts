// src/repositories/dashboard.repository.ts
import prisma from '@/config/database';
import { ReservationStatus, PaymentStatus } from '@/types/enums';

export class DashboardRepository {

  /**
   * Obtener estadísticas generales del propietario
   */
  async getOwnerStats(ownerId: string) {
    // Obtener todos los estacionamientos del propietario
    const parkingLots = await prisma.parkingLot.findMany({
      where: { ownerId },
      select: { id: true }
    });

    const parkingIds = parkingLots.map(p => p.id);

    // Estadísticas en paralelo
    const [
      totalRevenue,
      monthlyRevenue,
      totalReservations,
      activeReservations,
      completedReservations,
      cancelledReservations,
      avgRating,
      totalParkingLots,
      activeParkingLots
    ] = await Promise.all([
      // Total de ingresos (todos los tiempos)
      prisma.payment.aggregate({
        where: {
          reservation: {
            parkingLotId: { in: parkingIds }
          },
          status: PaymentStatus.COMPLETED
        },
        _sum: { netAmount: true }
      }),

      // Ingresos del mes actual
      prisma.payment.aggregate({
        where: {
          reservation: {
            parkingLotId: { in: parkingIds }
          },
          status: PaymentStatus.COMPLETED,
          completedAt: {
            gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1)
          }
        },
        _sum: { netAmount: true }
      }),

      // Total de reservas
      prisma.reservation.count({
        where: { parkingLotId: { in: parkingIds } }
      }),

      // Reservas activas
      prisma.reservation.count({
        where: {
          parkingLotId: { in: parkingIds },
          status: ReservationStatus.ACTIVE
        }
      }),

      // Reservas completadas
      prisma.reservation.count({
        where: {
          parkingLotId: { in: parkingIds },
          status: ReservationStatus.COMPLETED
        }
      }),

      // Reservas canceladas
      prisma.reservation.count({
        where: {
          parkingLotId: { in: parkingIds },
          status: ReservationStatus.CANCELLED
        }
      }),

      // Rating promedio
      prisma.review.aggregate({
        where: { parkingLotId: { in: parkingIds } },
        _avg: { rating: true }
      }),

      // Total de estacionamientos
      prisma.parkingLot.count({
        where: { ownerId }
      }),

      // Estacionamientos activos
      prisma.parkingLot.count({
        where: { ownerId, status: 'active' }
      })
    ]);

    return {
      totalRevenue: Number(totalRevenue._sum.netAmount || 0),
      monthlyRevenue: Number(monthlyRevenue._sum.netAmount || 0),
      totalReservations,
      activeReservations,
      completedReservations,
      cancelledReservations,
      averageRating: Number(avgRating._avg.rating || 0),
      totalParkingLots,
      activeParkingLots
    };
  }

  /**
   * Obtener ingresos por mes (últimos N meses)
   */
  async getMonthlyRevenue(ownerId: string, months: number = 12) {
    const parkingLots = await prisma.parkingLot.findMany({
      where: { ownerId },
      select: { id: true }
    });

    const parkingIds = parkingLots.map(p => p.id);

    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - months);

    const payments = await prisma.payment.findMany({
      where: {
        reservation: {
          parkingLotId: { in: parkingIds }
        },
        status: PaymentStatus.COMPLETED,
        completedAt: { gte: startDate }
      },
      select: {
        netAmount: true,
        completedAt: true
      }
    });

    // Agrupar por mes
    const revenueByMonth: Record<string, number> = {};

    payments.forEach(payment => {
      if (payment.completedAt) {
        const monthKey = `${payment.completedAt.getFullYear()}-${String(payment.completedAt.getMonth() + 1).padStart(2, '0')}`;
        revenueByMonth[monthKey] = (revenueByMonth[monthKey] || 0) + Number(payment.netAmount);
      }
    });

    return revenueByMonth;
  }

  /**
   * Obtener ingresos por día (últimos N días)
   */
  async getDailyRevenue(ownerId: string, days: number = 30) {
    const parkingLots = await prisma.parkingLot.findMany({
      where: { ownerId },
      select: { id: true }
    });

    const parkingIds = parkingLots.map(p => p.id);

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const payments = await prisma.payment.findMany({
      where: {
        reservation: {
          parkingLotId: { in: parkingIds }
        },
        status: PaymentStatus.COMPLETED,
        completedAt: { gte: startDate }
      },
      select: {
        netAmount: true,
        completedAt: true
      }
    });

    // Agrupar por día
    const revenueByDay: Record<string, number> = {};

    payments.forEach(payment => {
      if (payment.completedAt) {
        const dayKey = payment.completedAt.toISOString().split('T')[0];
        revenueByDay[dayKey] = (revenueByDay[dayKey] || 0) + Number(payment.netAmount);
      }
    });

    return revenueByDay;
  }

  /**
   * Obtener estadísticas por estacionamiento
   */
  async getStatsByParkingLot(ownerId: string) {
    const parkingLots = await prisma.parkingLot.findMany({
      where: { ownerId },
      select: {
        id: true,
        name: true,
        ratingAverage: true,
        totalReviews: true,
        totalSpots: true
      }
    });

    const stats = await Promise.all(
      parkingLots.map(async (parking) => {
        const [revenue, reservations, activeReservations] = await Promise.all([
          // Ingresos del estacionamiento
          prisma.payment.aggregate({
            where: {
              reservation: { parkingLotId: parking.id },
              status: PaymentStatus.COMPLETED
            },
            _sum: { netAmount: true }
          }),

          // Total de reservas
          prisma.reservation.count({
            where: { parkingLotId: parking.id }
          }),

          // Reservas activas
          prisma.reservation.count({
            where: {
              parkingLotId: parking.id,
              status: ReservationStatus.ACTIVE
            }
          })
        ]);

        return {
          parkingId: parking.id,
          parkingName: parking.name,
          totalRevenue: Number(revenue._sum.netAmount || 0),
          totalReservations: reservations,
          activeReservations,
          rating: parking.ratingAverage,
          totalReviews: parking.totalReviews,
          totalSpots: parking.totalSpots,
          occupancyRate: parking.totalSpots > 0 
            ? ((activeReservations / parking.totalSpots) * 100).toFixed(2)
            : '0'
        };
      })
    );

    return stats;
  }

  /**
   * Obtener últimas reseñas recibidas
   */
  async getRecentReviews(ownerId: string, limit: number = 10) {
    const parkingLots = await prisma.parkingLot.findMany({
      where: { ownerId },
      select: { id: true }
    });

    const parkingIds = parkingLots.map(p => p.id);

    const reviews = await prisma.review.findMany({
      where: { parkingLotId: { in: parkingIds } },
      include: {
        user: {
          select: {
            id: true,
            fullName: true
          }
        },
        parkingLot: {
          select: {
            id: true,
            name: true
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: limit
    });

    return reviews;
  }

  /**
   * Obtener horarios más ocupados
   */
  async getPeakHours(ownerId: string) {
    const parkingLots = await prisma.parkingLot.findMany({
      where: { ownerId },
      select: { id: true }
    });

    const parkingIds = parkingLots.map(p => p.id);

    const reservations = await prisma.reservation.findMany({
      where: {
        parkingLotId: { in: parkingIds },
        status: { in: [ReservationStatus.COMPLETED, ReservationStatus.ACTIVE] }
      },
      select: {
        startTime: true
      }
    });

    // Agrupar por hora
    const hourCounts: Record<number, number> = {};

    reservations.forEach(reservation => {
      const hour = new Date(reservation.startTime).getHours();
      hourCounts[hour] = (hourCounts[hour] || 0) + 1;
    });

    return hourCounts;
  }

  /**
   * Obtener ingresos en un rango de fechas
   */
  async getRevenueByDateRange(ownerId: string, startDate: Date, endDate: Date) {
    const parkingLots = await prisma.parkingLot.findMany({
      where: { ownerId },
      select: { id: true }
    });

    const parkingIds = parkingLots.map(p => p.id);

    const result = await prisma.payment.aggregate({
      where: {
        reservation: {
          parkingLotId: { in: parkingIds }
        },
        status: PaymentStatus.COMPLETED,
        completedAt: {
          gte: startDate,
          lte: endDate
        }
      },
      _sum: { netAmount: true },
      _count: true
    });

    return {
      totalRevenue: Number(result._sum.netAmount || 0),
      totalPayments: result._count
    };
  }
}

export default new DashboardRepository();
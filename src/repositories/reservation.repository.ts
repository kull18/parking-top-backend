import prisma from '@/config/database';
import { ReservationStatus } from '@/types/enums';

export class ReservationRepository {
  
  async findById(id: string) {
    return await prisma.reservation.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            fullName: true,
            email: true,
            phone: true
          }
        },
        parkingLot: true,
        parkingSpot: true,
        vehicle: true,
        payments: true
      }
    });
  }

  async findByCode(code: string) {
    return await prisma.reservation.findUnique({
      where: { reservationCode: code },
      include: {
        user: true,
        parkingLot: true,
        parkingSpot: true,
        vehicle: true
      }
    });
  }

  async findByUserId(userId: string, filters?: {
    status?: ReservationStatus[];
    upcoming?: boolean;
  }) {
    const where: any = { userId };

    if (filters?.status) {
      where.status = { in: filters.status };
    }

    if (filters?.upcoming) {
      where.startTime = { gte: new Date() };
    }

    return await prisma.reservation.findMany({
      where,
      include: {
        parkingLot: {
          select: {
            id: true,
            name: true,
            address: true,
            city: true
          }
        },
        parkingSpot: true,
        vehicle: true
      },
      orderBy: { createdAt: 'desc' }
    });
  }

  async findByParkingLotId(parkingLotId: string, filters?: {
    status?: ReservationStatus[];
    startDate?: Date;
    endDate?: Date;
  }) {
    const where: any = { parkingLotId };

    if (filters?.status) {
      where.status = { in: filters.status };
    }

    if (filters?.startDate || filters?.endDate) {
      where.startTime = {};
      if (filters.startDate) where.startTime.gte = filters.startDate;
      if (filters.endDate) where.startTime.lte = filters.endDate;
    }

    return await prisma.reservation.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            fullName: true,
            email: true,
            phone: true
          }
        },
        vehicle: true,
        parkingSpot: true
      },
      orderBy: { startTime: 'desc' }
    });
  }

  async create(data: any) {
    return await prisma.reservation.create({
      data
    });
  }

  async update(id: string, data: any) {
    return await prisma.reservation.update({
      where: { id },
      data
    });
  }

  async findActiveReservations() {
    return await prisma.reservation.findMany({
      where: {
        status: ReservationStatus.ACTIVE,
        endTime: { lt: new Date() }
      },
      include: {
        parkingLot: true,
        user: true
      }
    });
  }

  async findUpcomingReservationsForReminder(minutesBefore: number) {
    const targetTime = new Date(Date.now() + minutesBefore * 60 * 1000);
    const buffer = 5 * 60 * 1000; // 5 minutos de buffer

    return await prisma.reservation.findMany({
      where: {
        status: ReservationStatus.CONFIRMED,
        startTime: {
          gte: new Date(targetTime.getTime() - buffer),
          lte: new Date(targetTime.getTime() + buffer)
        }
      },
      include: {
        user: true,
        parkingLot: true
      }
    });
  }
}

export default new ReservationRepository();
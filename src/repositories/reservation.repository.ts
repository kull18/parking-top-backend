// src/repositories/reservation.repository.ts - ACTUALIZADO
import prisma from '@/config/database';
import { ReservationStatus } from '@/types/enums';

export class ReservationRepository {

  async create(data: any) {
    return await prisma.reservation.create({
      data: {
        ...data,
        parkingSpotId: data.parkingSpotId || null // ✅ Incluir parkingSpotId
      },
      include: {
        user: {
          select: {
            id: true,
            fullName: true,
            email: true,
            phone: true
          }
        },
        parkingLot: {
          select: {
            id: true,
            name: true,
            address: true,
            city: true,
            basePricePerHour: true,
            overtimeRatePerHour: true
          }
        },
        parkingSpot: { // ✅ Incluir relación de spot
          select: {
            id: true,
            spotNumber: true,
            status: true
          }
        },
        vehicle: {
          select: {
            id: true,
            brand: true,
            model: true,
            licensePlate: true
          }
        }
      }
    });
  }

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
        parkingLot: {
          select: {
            id: true,
            name: true,
            address: true,
            city: true,
            state: true,
            latitude: true,
            longitude: true,
            basePricePerHour: true,
            overtimeRatePerHour: true
          }
        },
        parkingSpot: { // ✅ Incluir spot
          select: {
            id: true,
            spotNumber: true,
            status: true,
            vehicleType: true
          }
        },
        vehicle: {
          select: {
            id: true,
            brand: true,
            model: true,
            licensePlate: true,
            color: true
          }
        },
        payments: {
          select: {
            id: true,
            amount: true,
            paymentMethod: true,
            status: true,
            transactionId: true,
            createdAt: true
          }
        },
        overtimeCharge: true
      }
    });
  }

  async findByUserId(userId: string, filters?: any) {
    return await prisma.reservation.findMany({
      where: {
        userId,
        ...(filters?.status && { status: { in: filters.status } })
      },
      include: {
        parkingLot: {
          select: {
            id: true,
            name: true,
            address: true,
            city: true,
            latitude: true,
            longitude: true
          }
        },
        parkingSpot: { // ✅ Incluir spot
          select: {
            id: true,
            spotNumber: true
          }
        },
        vehicle: {
          select: {
            id: true,
            brand: true,
            model: true,
            licensePlate: true
          }
        },
        payments: {
          select: {
            id: true,
            paymentMethod: true,
            status: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
  }

  async findByParkingLotId(parkingLotId: string, filters?: any) {
    return await prisma.reservation.findMany({
      where: {
        parkingLotId,
        ...(filters?.status && { status: { in: filters.status } }),
        ...(filters?.startDate && { 
          startTime: { gte: new Date(filters.startDate) } 
        }),
        ...(filters?.endDate && { 
          endTime: { lte: new Date(filters.endDate) } 
        })
      },
      include: {
        user: {
          select: {
            id: true,
            fullName: true,
            email: true,
            phone: true
          }
        },
        parkingSpot: { // ✅ Incluir spot
          select: {
            id: true,
            spotNumber: true
          }
        },
        vehicle: {
          select: {
            id: true,
            brand: true,
            model: true,
            licensePlate: true
          }
        },
        payments: {
          select: {
            id: true,
            paymentMethod: true,
            status: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
  }

  async findByOwnerId(ownerId: string, filters?: any) {
    return await prisma.reservation.findMany({
      where: {
        parkingLot: { ownerId },
        ...(filters?.status && { status: { in: filters.status } }),
        ...(filters?.startDate && {
          startTime: { gte: new Date(filters.startDate) }
        }),
        ...(filters?.endDate && {
          endTime: { lte: new Date(filters.endDate) }
        })
      },
      include: {
        user: {
          select: {
            id: true,
            fullName: true,
            email: true,
            phone: true
          }
        },
        parkingLot: {
          select: {
            id: true,
            name: true,
            address: true,
            city: true,
            state: true
          }
        },
        parkingSpot: {
          select: {
            id: true,
            spotNumber: true
          }
        },
        vehicle: {
          select: {
            id: true,
            brand: true,
            model: true,
            licensePlate: true
          }
        },
        payments: {
          select: {
            id: true,
            paymentMethod: true,
            status: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
  }

  async update(id: string, data: any) {
    return await prisma.reservation.update({
      where: { id },
      data: {
        ...data,
        parkingSpotId: data.parkingSpotId !== undefined ? data.parkingSpotId : undefined // ✅ Actualizar spot
      },
      include: {
        user: {
          select: {
            id: true,
            fullName: true,
            email: true
          }
        },
        parkingLot: {
          select: {
            id: true,
            name: true,
            address: true,
            city: true
          }
        },
        parkingSpot: { // ✅ Incluir spot
          select: {
            id: true,
            spotNumber: true,
            status: true
          }
        },
        vehicle: true
      }
    });
  }

  async findOverlapping(
    parkingLotId: string, 
    startTime: Date, 
    endTime: Date, 
    excludeReservationId?: string
  ) {
    return await prisma.reservation.findMany({
      where: {
        parkingLotId,
        status: { in: [ReservationStatus.CONFIRMED, ReservationStatus.ACTIVE] },
        ...(excludeReservationId && { id: { not: excludeReservationId } }),
        OR: [
          { AND: [{ startTime: { lte: startTime } }, { endTime: { gt: startTime } }] },
          { AND: [{ startTime: { lt: endTime } }, { endTime: { gte: endTime } }] },
          { AND: [{ startTime: { gte: startTime } }, { endTime: { lte: endTime } }] }
        ]
      },
      include: {
        parkingSpot: { // ✅ Incluir spot
          select: {
            id: true,
            spotNumber: true
          }
        }
      }
    });
  }

  async findPending() {
    return await prisma.reservation.findMany({
      where: {
        status: ReservationStatus.PENDING,
        createdAt: { lte: new Date(Date.now() - 30 * 60 * 1000) }
      }
    });
  }

  async countByStatus(status: ReservationStatus) {
    return await prisma.reservation.count({
      where: { status }
    });
  }
}

export default new ReservationRepository();
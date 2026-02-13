import prisma from '@/config/database';
import { ParkingStatus } from '@/types/enums';

export class ParkingRepository {
  
  async findById(id: string) {
    return await prisma.parkingLot.findUnique({
      where: { id },
      include: {
        owner: {
          select: {
            id: true,
            fullName: true,
            email: true,
            phone: true
          }
        },
        spots: true,
        reviews: {
          include: {
            user: {
              select: {
                id: true,
                fullName: true,
                profileImageUrl: true
              }
            }
          },
          orderBy: { createdAt: 'desc' },
          take: 10
        }
      }
    });
  }

  async findByOwnerId(ownerId: string) {
    return await prisma.parkingLot.findMany({
      where: {
        ownerId,
        status: { not: ParkingStatus.INACTIVE }
      },
      include: {
        subscription: {
          include: { plan: true }
        },
        _count: {
          select: {
            reviews: true,
            reservations: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
  }

  async findActive() {
    return await prisma.parkingLot.findMany({
      where: {
        status: ParkingStatus.ACTIVE
      },
      include: {
        owner: {
          select: {
            id: true,
            fullName: true
          }
        }
      }
    });
  }

  async create(data: any) {
    return await prisma.parkingLot.create({
      data
    });
  }

  async update(id: string, data: any) {
    return await prisma.parkingLot.update({
      where: { id },
      data
    });
  }

  async countByOwnerId(ownerId: string, excludeInactive: boolean = true) {
    return await prisma.parkingLot.count({
      where: {
        ownerId,
        ...(excludeInactive && { status: { not: ParkingStatus.INACTIVE } })
      }
    });
  }

  async updateAvailableSpots(id: string, increment: number) {
    return await prisma.parkingLot.update({
      where: { id },
      data: {
        availableSpots: {
          increment
        }
      }
    });
  }
}

export default new ParkingRepository();
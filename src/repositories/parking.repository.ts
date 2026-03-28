import prisma from '@/config/database';
import { ParkingStatus } from '@/types/enums';

export class ParkingRepository {


  async findById(id: string) {
  const parking = await prisma.parkingLot.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      description: true,
      address: true,
      city: true,
      state: true,
      latitude: true,
      longitude: true,
      images: true,

      totalSpots: true,
      availableSpots: true,

      basePricePerHour: true,
      overtimeRatePerHour: true,

      operatingHours: true,
      features: true,

      ratingAverage: true,
      totalReviews: true,

      owner: {
        select: {
          id: true,
          fullName: true,
          email: true,
          phone: true
        }
      },

      spots: {
        select: {
          id: true,
          spotNumber: true,
          status: true,
          vehicleType: true
        }
      },

      reviews: {
        orderBy: {
          createdAt: 'desc'
        },
        take: 10,
        select: {
          id: true,
          rating: true,
          comment: true,
          ownerResponse: true,
          ownerResponseAt: true,
          createdAt: true,
          user: {
            select: {
              id: true,
              fullName: true,
              profileImageUrl: true
            }
          }
        }
      }
    }
  });

  if (!parking) return null;

  return {
    ...parking,

    // calcular espacios disponibles
    availability: {
      available: parking.availableSpots,
      total: parking.totalSpots
    },

    // precios formateados
    pricing: {
      basePricePerHour: parking.basePricePerHour,
      overtimeRatePerHour: parking.overtimeRatePerHour
    }
  };
}

  async getParkingLots() {
    return await prisma.parkingLot.findMany({
      where: {
        status: ParkingStatus.ACTIVE
      },
      include: {
        owner: {
          select: {
            id: true,
            fullName: true
          }        },
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
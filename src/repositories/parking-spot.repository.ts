import prisma from '@/config/database';

export interface CreateParkingSpotData {
  parkingLotId: string;
  spotNumber: string;
  status?: string;
  vehicleType?: string;
  floor?: string;
  section?: string;
}

export interface UpdateParkingSpotData {
  spotNumber?: string;
  status?: string;
  vehicleType?: string;
  floor?: string;
  section?: string;
}

export class ParkingSpotRepository {
  async findById(id: string) {
    return await prisma.parkingSpot.findUnique({
      where: { id },
      include: {
        parkingLot: {
          select: {
            id: true,
            ownerId: true,
            name: true
          }
        }
      }
    });
  }

  async findByParkingLotId(parkingLotId: string) {
    return await prisma.parkingSpot.findMany({
      where: { parkingLotId },
      orderBy: { spotNumber: 'asc' }
    });
  }

  async create(data: CreateParkingSpotData) {
    return await prisma.parkingSpot.create({
      data
    });
  }

  async update(id: string, data: UpdateParkingSpotData) {
    return await prisma.parkingSpot.update({
      where: { id },
      data
    });
  }

  async delete(id: string) {
    return await prisma.parkingSpot.delete({
      where: { id }
    });
  }

  async findParkingLotById(parkingLotId: string) {
    return await prisma.parkingLot.findUnique({
      where: { id: parkingLotId },
      select: {
        id: true,
        ownerId: true
      }
    });
  }
}

export default new ParkingSpotRepository();

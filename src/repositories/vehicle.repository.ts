import prisma from '@/config/database';

export class VehicleRepository {

  async findById(vehicleId: string) {
    return await prisma.vehicle.findUnique({
      where: { id: vehicleId }
    });
  }

  async findByUserId(userId: string) {
    return await prisma.vehicle.findMany({
      where: { userId },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }]
    });
  }

  async findByUserIdAndId(userId: string, vehicleId: string) {
    return await prisma.vehicle.findFirst({
      where: { id: vehicleId, userId }
    });
  }

  async create(data: {
    userId: string;
    licensePlate: string;
    brand?: string;
    model?: string;
    color?: string;
    vehicleType?: string;
    isDefault: boolean;
  }) {
    return await prisma.vehicle.create({
      data
    });
  }

  async update(vehicleId: string, data: {
    brand?: string;
    model?: string;
    color?: string;
    vehicleType?: string;
    isDefault?: boolean;
  }) {
    return await prisma.vehicle.update({
      where: { id: vehicleId },
      data
    });
  }

  async delete(vehicleId: string) {
    return await prisma.vehicle.delete({
      where: { id: vehicleId }
    });
  }

  async unsetDefaultForUser(userId: string, exceptVehicleId?: string) {
    return await prisma.vehicle.updateMany({
      where: {
        userId,
        ...(exceptVehicleId && { id: { not: exceptVehicleId } })
      },
      data: { isDefault: false }
    });
  }
}

export default new VehicleRepository();
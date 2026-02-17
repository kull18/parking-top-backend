import userRepository from '@/repositories/user.repository';
import vehicleRepository from '@/repositories/vehicle.repository';
import logger from '@/utils/logger';

export class UserService {

  async getUserById(userId: string) {
    const user = await userRepository.findById(userId);

    if (!user) {
      throw new Error('USER_NOT_FOUND');
    }

    return user;
  }

  async updateUser(userId: string, data: {
    fullName?: string;
    phone?: string;
    profileImageUrl?: string;
  }) {
    return await userRepository.update(userId, data);
  }

  async getUserStats(userId: string, role: 'customer' | 'owner') {
    if (role === 'customer') {
      const [totalReservations, activeReservations, totalSpent] = await Promise.all([
        userRepository.countReservations(userId),
        userRepository.countActiveReservations(userId),
        userRepository.getTotalSpent(userId)
      ]);

      return {
        totalReservations,
        activeReservations,
        totalSpent
      };
    }

    if (role === 'owner') {
      const [totalParkings, totalReservations, totalRevenue] = await Promise.all([
        userRepository.countParkingsByOwner(userId),
        userRepository.countReservationsByOwner(userId),
        userRepository.getTotalRevenueByOwner(userId)
      ]);

      return {
        totalParkings,
        totalReservations,
        totalRevenue
      };
    }

    return {};
  }

  // ========== VEHÍCULOS ==========

  async getVehicles(userId: string) {
    return await vehicleRepository.findByUserId(userId);
  }

  async addVehicle(userId: string, data: {
    licensePlate: string;
    brand?: string;
    model?: string;
    color?: string;
    vehicleType?: string;
    isDefault?: boolean;
  }) {
    try {
      // Si es default, quitar default de otros vehículos
      if (data.isDefault) {
        await vehicleRepository.unsetDefaultForUser(userId);
      }

      const vehicle = await vehicleRepository.create({
        userId,
        licensePlate: data.licensePlate,
        brand: data.brand,
        model: data.model,
        color: data.color,
        vehicleType: data.vehicleType || 'car',
        isDefault: data.isDefault || false
      });

      logger.info(`Vehicle added for user ${userId}: ${vehicle.id}`);

      return vehicle;
    } catch (error: any) {
      if (error.code === 'P2002') {
        throw new Error('DUPLICATE_VEHICLE');
      }
      throw error;
    }
  }

  async updateVehicle(userId: string, vehicleId: string, data: {
    brand?: string;
    model?: string;
    color?: string;
    vehicleType?: string;
    isDefault?: boolean;
  }) {
    const vehicle = await vehicleRepository.findByUserIdAndId(userId, vehicleId);

    if (!vehicle) {
      throw new Error('VEHICLE_NOT_FOUND');
    }

    // Si se marca como default, quitar default de otros
    if (data.isDefault) {
      await vehicleRepository.unsetDefaultForUser(userId, vehicleId);
    }

    const updated = await vehicleRepository.update(vehicleId, data);

    logger.info(`Vehicle updated: ${vehicleId}`);

    return updated;
  }

  async deleteVehicle(userId: string, vehicleId: string) {
    const vehicle = await vehicleRepository.findByUserIdAndId(userId, vehicleId);

    if (!vehicle) {
      throw new Error('VEHICLE_NOT_FOUND');
    }

    await vehicleRepository.delete(vehicleId);

    logger.info(`Vehicle deleted: ${vehicleId}`);
  }
}

export default new UserService();
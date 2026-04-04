import { UserRole } from '@/types/enums';
import logger from '@/utils/logger';
import parkingSpotRepository, {
  CreateParkingSpotData,
  UpdateParkingSpotData
} from '@/repositories/parking-spot.repository';

export class ParkingSpotService {
  private async validateParkingOwnership(
    parkingLotId: string,
    userId: string,
    role: UserRole
  ): Promise<void> {
    const parkingLot = await parkingSpotRepository.findParkingLotById(parkingLotId);

    if (!parkingLot) {
      throw new Error('PARKING_LOT_NOT_FOUND');
    }

    if (role !== UserRole.ADMIN && parkingLot.ownerId !== userId) {
      throw new Error('FORBIDDEN');
    }
  }

  async getByParkingLotId(parkingLotId: string) {
    try {
      const spots = await parkingSpotRepository.findByParkingLotId(parkingLotId);
      return spots;
    } catch (error) {
      logger.error(`Error getting parking spots by parkingLotId ${parkingLotId}:`, error);
      throw error;
    }
  }

  async getById(id: string) {
    try {
      const spot = await parkingSpotRepository.findById(id);

      if (!spot) {
        throw new Error('PARKING_SPOT_NOT_FOUND');
      }

      return spot;
    } catch (error) {
      logger.error(`Error getting parking spot ${id}:`, error);
      throw error;
    }
  }

  async create(userId: string, role: UserRole, data: CreateParkingSpotData) {
    try {
      await this.validateParkingOwnership(data.parkingLotId, userId, role);

      const spot = await parkingSpotRepository.create({
        parkingLotId: data.parkingLotId,
        spotNumber: data.spotNumber,
        status: data.status || 'available',
        vehicleType: data.vehicleType || 'car',
        floor: data.floor,
        section: data.section
      });

      logger.info(`Parking spot created: ${spot.id}`);
      return spot;
    } catch (error: any) {
      if (error.code === 'P2002') {
        throw new Error('DUPLICATE_SPOT_NUMBER');
      }
      logger.error('Error creating parking spot:', error);
      throw error;
    }
  }

  async update(userId: string, role: UserRole, id: string, data: UpdateParkingSpotData) {
    try {
      const existingSpot = await parkingSpotRepository.findById(id);

      if (!existingSpot) {
        throw new Error('PARKING_SPOT_NOT_FOUND');
      }

      await this.validateParkingOwnership(existingSpot.parkingLotId, userId, role);

      const updated = await parkingSpotRepository.update(id, data);
      logger.info(`Parking spot updated: ${id}`);

      return updated;
    } catch (error: any) {
      if (error.code === 'P2002') {
        throw new Error('DUPLICATE_SPOT_NUMBER');
      }
      logger.error(`Error updating parking spot ${id}:`, error);
      throw error;
    }
  }

  async delete(userId: string, role: UserRole, id: string) {
    try {
      const existingSpot = await parkingSpotRepository.findById(id);

      if (!existingSpot) {
        throw new Error('PARKING_SPOT_NOT_FOUND');
      }

      await this.validateParkingOwnership(existingSpot.parkingLotId, userId, role);

      await parkingSpotRepository.delete(id);
      logger.info(`Parking spot deleted: ${id}`);
    } catch (error: any) {
      if (error.code === 'P2003') {
        throw new Error('PARKING_SPOT_IN_USE');
      }
      logger.error(`Error deleting parking spot ${id}:`, error);
      throw error;
    }
  }
}

export default new ParkingSpotService();

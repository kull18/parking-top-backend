import vehicleRepository from '@/repositories/vehicle.repository';
import logger from '@/utils/logger';

export class VehicleService {

  /**
   * Obtiene todos los vehículos del usuario
   */
  async getVehiclesByUserId(userId: string) {
    try {
      const vehicles = await vehicleRepository.findByUserId(userId);
      logger.info(`Retrieved ${vehicles.length} vehicles for user ${userId}`);
      return vehicles;
    } catch (error) {
      logger.error(`Error retrieving vehicles for user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Obtiene un vehículo específico por ID
   */
  async getVehicleById(vehicleId: string) {
    try {
      const vehicle = await vehicleRepository.findById(vehicleId);

      if (!vehicle) {
        throw new Error('VEHICLE_NOT_FOUND');
      }

      return vehicle;
    } catch (error) {
      logger.error(`Error retrieving vehicle ${vehicleId}:`, error);
      throw error;
    }
  }

  /**
   * Obtiene un vehículo validando que pertenezca al usuario
   */
  async getVehicleByIdAndUserId(userId: string, vehicleId: string) {
    try {
      const vehicle = await vehicleRepository.findByUserIdAndId(userId, vehicleId);

      if (!vehicle) {
        throw new Error('VEHICLE_NOT_FOUND');
      }

      return vehicle;
    } catch (error) {
      logger.error(`Error retrieving vehicle ${vehicleId} for user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Crea un nuevo vehículo
   */
  async createVehicle(userId: string, data: {
    licensePlate: string;
    brand?: string;
    model?: string;
    color?: string;
    vehicleType?: string;
    isDefault?: boolean;
  }) {
    try {
      // Si es el vehículo por defecto, desmarcar otros
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

      logger.info(`Vehicle created for user ${userId}: ${vehicle.id}`);
      return vehicle;
    } catch (error: any) {
      if (error.code === 'P2002') {
        logger.warn(`Duplicate vehicle plate for user ${userId}: ${data.licensePlate}`);
        throw new Error('DUPLICATE_VEHICLE');
      }
      logger.error(`Error creating vehicle for user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Actualiza un vehículo existente
   */
  async updateVehicle(userId: string, vehicleId: string, data: {
    licensePlate?: string;
    brand?: string;
    model?: string;
    color?: string;
    vehicleType?: string;
    isDefault?: boolean;
  }) {
    try {
      // Validar que el vehículo pertenezca al usuario
      const vehicle = await vehicleRepository.findByUserIdAndId(userId, vehicleId);

      if (!vehicle) {
        throw new Error('VEHICLE_NOT_FOUND');
      }

      // Si se marca como default, desmarcar otros
      if (data.isDefault) {
        await vehicleRepository.unsetDefaultForUser(userId, vehicleId);
      }

      const updated = await vehicleRepository.update(vehicleId, data);

      logger.info(`Vehicle updated: ${vehicleId}`);
      return updated;
    } catch (error: any) {
      if (error.code === 'P2002') {
        logger.warn(`Duplicate vehicle plate: ${data.licensePlate}`);
        throw new Error('DUPLICATE_VEHICLE');
      }
      logger.error(`Error updating vehicle ${vehicleId}:`, error);
      throw error;
    }
  }

  /**
   * Elimina un vehículo
   */
  async deleteVehicle(userId: string, vehicleId: string) {
    try {
      // Validar que el vehículo pertenezca al usuario
      const vehicle = await vehicleRepository.findByUserIdAndId(userId, vehicleId);

      if (!vehicle) {
        throw new Error('VEHICLE_NOT_FOUND');
      }

      await vehicleRepository.delete(vehicleId);

      logger.info(`Vehicle deleted: ${vehicleId}`);
    } catch (error) {
      logger.error(`Error deleting vehicle ${vehicleId}:`, error);
      throw error;
    }
  }

  /**
   * Establece un vehículo como default
   */
  async setDefaultVehicle(userId: string, vehicleId: string) {
    try {
      // Validar que el vehículo pertenezca al usuario
      const vehicle = await vehicleRepository.findByUserIdAndId(userId, vehicleId);

      if (!vehicle) {
        throw new Error('VEHICLE_NOT_FOUND');
      }

      // Desmarcar otros vehículos como default
      await vehicleRepository.unsetDefaultForUser(userId, vehicleId);

      // Marcar este como default
      const updated = await vehicleRepository.update(vehicleId, { isDefault: true });

      logger.info(`Vehicle set as default: ${vehicleId}`);
      return updated;
    } catch (error) {
      logger.error(`Error setting default vehicle ${vehicleId}:`, error);
      throw error;
    }
  }

  /**
   * Obtiene el vehículo default del usuario
   */
  async getDefaultVehicle(userId: string) {
    try {
      const vehicles = await vehicleRepository.findByUserId(userId);
      const defaultVehicle = vehicles.find(v => v.isDefault);

      if (!defaultVehicle && vehicles.length > 0) {
        return vehicles[0]; // Retornar el más reciente si no hay default
      }

      return defaultVehicle || null;
    } catch (error) {
      logger.error(`Error retrieving default vehicle for user ${userId}:`, error);
      throw error;
    }
  }
}

export default new VehicleService();

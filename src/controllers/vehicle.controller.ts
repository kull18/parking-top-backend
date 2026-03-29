import { Response, NextFunction } from 'express';
import { AuthRequest } from '@/types/interfaces';
import vehicleService from '@/services/vehicle.service';
import { sendSuccess, sendError } from '@/utils/response';

export class VehicleController {

  /**
   * GET /vehicles
   * Obtiene todos los vehículos del usuario autenticado
   */
  async getVehicles(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;

      const vehicles = await vehicleService.getVehiclesByUserId(userId);

      sendSuccess(res, vehicles);
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /vehicles/:id
   * Obtiene un vehículo específico
   */
  async getVehicleById(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const { id } = req.params;

      const vehicle = await vehicleService.getVehicleByIdAndUserId(userId, id);

      sendSuccess(res, vehicle);
    } catch (error: any) {
      if (error.message === 'VEHICLE_NOT_FOUND') {
        sendError(res, 'VEHICLE_NOT_FOUND', 'Vehículo no encontrado', 404);
      } else {
        next(error);
      }
    }
  }

  /**
   * POST /vehicles
   * Crea un nuevo vehículo
   */
  async createVehicle(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const { licensePlate, brand, model, color, vehicleType, isDefault } = req.body;

      // Validar que licensePlate sea proporcionado
      if (!licensePlate) {
        sendError(res, 'INVALID_INPUT', 'La placa del vehículo es requerida', 400);
        return;
      }

      const vehicle = await vehicleService.createVehicle(userId, {
        licensePlate,
        brand,
        model,
        color,
        vehicleType,
        isDefault
      });

      sendSuccess(res, vehicle, 201);
    } catch (error: any) {
      if (error.message === 'DUPLICATE_VEHICLE') {
        sendError(res, 'DUPLICATE_VEHICLE', 'Ya tienes un vehículo con estas placas', 400);
      } else {
        next(error);
      }
    }
  }

  /**
   * PUT /vehicles/:id
   * Actualiza un vehículo existente
   */
  async updateVehicle(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const { id } = req.params;
      const { licensePlate, brand, model, color, vehicleType, isDefault } = req.body;

      const vehicle = await vehicleService.updateVehicle(userId, id, {
        licensePlate,
        brand,
        model,
        color,
        vehicleType,
        isDefault
      });

      sendSuccess(res, vehicle);
    } catch (error: any) {
      if (error.message === 'VEHICLE_NOT_FOUND') {
        sendError(res, 'VEHICLE_NOT_FOUND', 'Vehículo no encontrado', 404);
      } else if (error.message === 'DUPLICATE_VEHICLE') {
        sendError(res, 'DUPLICATE_VEHICLE', 'Ya existe un vehículo con estas placas', 400);
      } else {
        next(error);
      }
    }
  }

  /**
   * DELETE /vehicles/:id
   * Elimina un vehículo
   */
  async deleteVehicle(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const { id } = req.params;

      await vehicleService.deleteVehicle(userId, id);

      sendSuccess(res, { message: 'Vehículo eliminado satisfactoriamente' });
    } catch (error: any) {
      if (error.message === 'VEHICLE_NOT_FOUND') {
        sendError(res, 'VEHICLE_NOT_FOUND', 'Vehículo no encontrado', 404);
      } else {
        next(error);
      }
    }
  }

  /**
   * PATCH /vehicles/:id/set-default
   * Establece un vehículo como default
   */
  async setDefaultVehicle(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const { id } = req.params;

      const vehicle = await vehicleService.setDefaultVehicle(userId, id);

      sendSuccess(res, vehicle);
    } catch (error: any) {
      if (error.message === 'VEHICLE_NOT_FOUND') {
        sendError(res, 'VEHICLE_NOT_FOUND', 'Vehículo no encontrado', 404);
      } else {
        next(error);
      }
    }
  }

  /**
   * GET /vehicles/default
   * Obtiene el vehículo default del usuario
   */
  async getDefaultVehicle(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;

      const vehicle = await vehicleService.getDefaultVehicle(userId);

      if (!vehicle) {
        sendError(res, 'NO_DEFAULT_VEHICLE', 'No hay vehículo default configurado', 404);
        return;
      }

      sendSuccess(res, vehicle);
    } catch (error) {
      next(error);
    }
  }
}

export default new VehicleController();

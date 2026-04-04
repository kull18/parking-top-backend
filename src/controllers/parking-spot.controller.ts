import { NextFunction, Response } from 'express';
import { AuthRequest } from '@/types/interfaces';
import parkingSpotService from '@/services/parking-spot.service';
import { sendError, sendSuccess } from '@/utils/response';

export class ParkingSpotController {
  async getByParkingLotId(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { parkingLotId } = req.params;

      const spots = await parkingSpotService.getByParkingLotId(parkingLotId);

      sendSuccess(res, spots);
    } catch (error) {
      next(error);
    }
  }

  async getById(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;

      const spot = await parkingSpotService.getById(id);

      sendSuccess(res, spot);
    } catch (error: any) {
      if (error.message === 'PARKING_SPOT_NOT_FOUND') {
        sendError(res, 'PARKING_SPOT_NOT_FOUND', 'Espacio no encontrado', 404);
      } else {
        next(error);
      }
    }
  }

  async create(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const role = req.user!.role;

      const spot = await parkingSpotService.create(userId, role, req.body);

      sendSuccess(res, spot, 201);
    } catch (error: any) {
      if (error.message === 'PARKING_LOT_NOT_FOUND') {
        sendError(res, 'PARKING_LOT_NOT_FOUND', 'Estacionamiento no encontrado', 404);
      } else if (error.message === 'FORBIDDEN') {
        sendError(res, 'FORBIDDEN', 'No tienes permiso para este estacionamiento', 403);
      } else if (error.message === 'DUPLICATE_SPOT_NUMBER') {
        sendError(
          res,
          'DUPLICATE_SPOT_NUMBER',
          'Ya existe un espacio con ese número en este estacionamiento',
          400
        );
      } else {
        next(error);
      }
    }
  }

  async update(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const role = req.user!.role;
      const { id } = req.params;

      const updated = await parkingSpotService.update(userId, role, id, req.body);

      sendSuccess(res, updated);
    } catch (error: any) {
      if (error.message === 'PARKING_SPOT_NOT_FOUND') {
        sendError(res, 'PARKING_SPOT_NOT_FOUND', 'Espacio no encontrado', 404);
      } else if (error.message === 'FORBIDDEN') {
        sendError(res, 'FORBIDDEN', 'No tienes permiso para este estacionamiento', 403);
      } else if (error.message === 'DUPLICATE_SPOT_NUMBER') {
        sendError(
          res,
          'DUPLICATE_SPOT_NUMBER',
          'Ya existe un espacio con ese número en este estacionamiento',
          400
        );
      } else {
        next(error);
      }
    }
  }

  async delete(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const role = req.user!.role;
      const { id } = req.params;

      await parkingSpotService.delete(userId, role, id);

      sendSuccess(res, { message: 'Espacio eliminado correctamente' });
    } catch (error: any) {
      if (error.message === 'PARKING_SPOT_NOT_FOUND') {
        sendError(res, 'PARKING_SPOT_NOT_FOUND', 'Espacio no encontrado', 404);
      } else if (error.message === 'FORBIDDEN') {
        sendError(res, 'FORBIDDEN', 'No tienes permiso para este estacionamiento', 403);
      } else if (error.message === 'PARKING_SPOT_IN_USE') {
        sendError(
          res,
          'PARKING_SPOT_IN_USE',
          'No se puede eliminar un espacio con reservas asociadas',
          400
        );
      } else {
        next(error);
      }
    }
  }
}

export default new ParkingSpotController();

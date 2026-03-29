import { Router } from 'express';
import vehicleController from '@/controllers/vehicle.controller';
import { authenticate } from '@/middlewares/auth.middleware';

const router = Router();

// Todas las rutas requieren autenticación
router.use(authenticate);

/**
 * GET /vehicles
 * Obtiene todos los vehículos del usuario
 */
router.get('/', vehicleController.getVehicles);

/**
 * GET /vehicles/default
 * Obtiene el vehículo default (colocar antes que /:id para evitar conflictos)
 */
router.get('/default', vehicleController.getDefaultVehicle);

/**
 * POST /vehicles
 * Crea un nuevo vehículo
 * Body: { licensePlate, brand?, model?, color?, vehicleType?, isDefault? }
 */
router.post('/', vehicleController.createVehicle);

/**
 * GET /vehicles/:id
 * Obtiene un vehículo específico
 */
router.get('/:id', vehicleController.getVehicleById);

/**
 * PUT /vehicles/:id
 * Actualiza un vehículo
 * Body: { licensePlate?, brand?, model?, color?, vehicleType?, isDefault? }
 */
router.put('/:id', vehicleController.updateVehicle);

/**
 * DELETE /vehicles/:id
 * Elimina un vehículo
 */
router.delete('/:id', vehicleController.deleteVehicle);

/**
 * PATCH /vehicles/:id/set-default
 * Establece un vehículo como default
 */
router.patch('/:id/set-default', vehicleController.setDefaultVehicle);

export default router;

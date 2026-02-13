import { Router } from 'express';
import parkingController from '@/controllers/parking.controller';
import { authenticate, authorize, checkActiveSubscription } from '@/middlewares/auth.middleware';
import { validateRequest, validateQuery } from '@/middlewares/validation.middleware';
import { createParkingSchema, nearbyParkingSchema } from '@/utils/validators';
import { UserRole } from '@/types/enums';

const router = Router();

// Rutas públicas
router.get('/nearby', validateQuery(nearbyParkingSchema), parkingController.getNearby);
router.get('/:id', parkingController.getById);

// Rutas protegidas (propietarios)
router.use(authenticate);
router.use(authorize(UserRole.OWNER));

router.get('/owner/my-parkings', parkingController.getOwnerParkings);
router.post(
  '/',
  checkActiveSubscription,
  validateRequest(createParkingSchema),
  parkingController.create
);
router.put('/:id', parkingController.update);
router.delete('/:id', parkingController.delete);

export default router;
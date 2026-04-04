import { Router } from 'express';
import parkingSpotController from '@/controllers/parking-spot.controller';
import { authenticate, authorize } from '@/middlewares/auth.middleware';
import { validateRequest } from '@/middlewares/validation.middleware';
import { createParkingSpotSchema, updateParkingSpotSchema } from '@/utils/validators';
import { UserRole } from '@/types/enums';

const router = Router();

router.use(authenticate);

router.get('/parking-lot/:parkingLotId', parkingSpotController.getByParkingLotId);
router.get('/:id', parkingSpotController.getById);

router.post(
  '/',
  authorize(UserRole.OWNER, UserRole.ADMIN),
  validateRequest(createParkingSpotSchema),
  parkingSpotController.create
);

router.put(
  '/:id',
  authorize(UserRole.OWNER, UserRole.ADMIN),
  validateRequest(updateParkingSpotSchema),
  parkingSpotController.update
);

router.delete(
  '/:id',
  authorize(UserRole.OWNER, UserRole.ADMIN),
  parkingSpotController.delete
);

export default router;

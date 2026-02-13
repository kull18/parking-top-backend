import { Router } from 'express';
import reviewController from '@/controllers/review.controller';
import { authenticate, authorize } from '@/middlewares/auth.middleware';
import { UserRole } from '@/types/enums';

const router = Router();

// Rutas públicas
router.get('/parking/:parkingId', reviewController.getParkingReviews);

// Rutas protegidas
router.use(authenticate);

// Crear reseña (solo clientes)
router.post('/', authorize(UserRole.CUSTOMER), reviewController.create);

// Responder reseña (solo propietarios)
router.post(
  '/:reviewId/respond',
  authorize(UserRole.OWNER),
  reviewController.respondToReview
);

export default router;
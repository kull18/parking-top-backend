import { Router } from 'express';
import reviewController from '@/controllers/review.controller';
import { authenticate } from '@/middlewares/auth.middleware';
import { authorize } from '@/middlewares/role.middleware';
import { UserRole } from '@/types/enums';
import { validateRequest } from '@/middlewares/validation.middleware';
import { createReviewSchema, respondReviewSchema, updateReviewSchema } from '@/utils/validators';

const router = Router();

// ════════════════════════════════════════════════════════════════
// RUTAS PÚBLICAS
// ════════════════════════════════════════════════════════════════

/**
 * GET /reviews/parking/:parkingId
 * Obtener todas las reseñas de un estacionamiento
 */
router.get('/parking/:parkingId', reviewController.getParkingReviews);

/**
 * GET /reviews/:id
 * Obtener una reseña específica
 */
// NOTA: esta ruta debe declararse al final para no interceptar rutas
// más específicas como /me/reviews.

// ════════════════════════════════════════════════════════════════
// RUTAS PROTEGIDAS (requieren autenticación)
// ════════════════════════════════════════════════════════════════

router.use(authenticate);

/**
 * GET /reviews/my-reviews
 * Obtener mis reseñas (usuario autenticado)
 */
router.get('/me/reviews', reviewController.getMyReviews);

/**
 * POST /reviews
 * Crear nueva reseña (solo clientes)
 */
router.post(
  '/',
  authorize(UserRole.CUSTOMER),
  validateRequest(createReviewSchema),
  reviewController.create
);

/**
 * PUT /reviews/:id
 * Actualizar mi reseña
 */
router.put(
  '/:id',
  authorize(UserRole.CUSTOMER),
  validateRequest(updateReviewSchema),
  reviewController.update
);

/**
 * DELETE /reviews/:id
 * Eliminar mi reseña
 */
router.delete(
  '/:id',
  authorize(UserRole.CUSTOMER),
  reviewController.delete
);

/**
 * POST /reviews/:id/respond
 * Responder a una reseña (solo propietarios)
 */
router.post(
  '/:id/respond',
  authorize(UserRole.OWNER),
  validateRequest(respondReviewSchema),
  reviewController.respondToReview
);

/**
 * GET /reviews/:id
 * Obtener una reseña específica
 */
router.get('/:id', reviewController.getById);

export default router;
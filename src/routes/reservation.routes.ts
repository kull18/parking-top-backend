// src/routes/reservation.routes.ts - COMPLETO
import { Router } from 'express';
import reservationController from '@/controllers/reservation.controller';
import { authenticate } from '@/middlewares/auth.middleware';
import { authorize } from '@/middlewares/role.middleware';
import { validateRequest } from '@/middlewares/validation.middleware';
import { 
  createReservationSchema, 
  cancelReservationSchema,
  checkAvailabilitySchema 
} from '@/utils/validators';
import { UserRole } from '@/types/enums';

const router = Router();

// Todas las rutas requieren autenticación
router.use(authenticate);

// ═══════════════════════════════════════
// RUTAS PÚBLICAS (Customer, Owner)
// ═══════════════════════════════════════

/**
 * Crear reserva (con método de pago y espacio opcional)
 * POST /v1/reservations
 * Body: {
 *   parkingLotId, 
 *   parkingSpotId?, 
 *   vehicleId?, 
 *   startTime, 
 *   endTime, 
 *   paymentMethod: "mercadopago" | "cash"
 * }
 */
router.post(
  '/',
  validateRequest(createReservationSchema),
  reservationController.create
);

/**
 * Verificar disponibilidad
 * GET /v1/reservations/availability?parkingLotId=xxx&startTime=xxx&endTime=xxx
 */
router.get(
  '/availability',
  validateRequest(checkAvailabilitySchema),
  reservationController.checkAvailability
);

/**
 * Obtener mis reservas
 * GET /v1/reservations/my?status=pending,confirmed
 */
router.get(
  '/my',
  reservationController.getUserReservations
);

/**
 * Obtener reserva por ID
 * GET /v1/reservations/:id
 */
router.get(
  '/:id',
  reservationController.getById
);

/**
 * Check-in (auto-confirma pago en efectivo si está pendiente)
 * PUT /v1/reservations/:id/check-in
 */
router.put(
  '/:id/check-in',
  reservationController.checkIn
);

/**
 * Check-out
 * PUT /v1/reservations/:id/check-out
 */
router.put(
  '/:id/check-out',
  reservationController.checkOut
);

/**
 * Pagar overtime
 * POST /v1/reservations/:id/pay-overtime
 */
router.post(
  '/:id/pay-overtime',
  reservationController.payOvertime
);

/**
 * Cancelar reserva
 * PUT /v1/reservations/:id/cancel
 * Body: { reason?: string }
 */
router.put(
  '/:id/cancel',
  validateRequest(cancelReservationSchema),
  reservationController.cancel
);

// ═══════════════════════════════════════
// RUTAS DE OWNER
// ═══════════════════════════════════════

/**
 * Confirmar pago en efectivo (Owner/Admin)
 * PUT /v1/reservations/:id/confirm-cash-payment
 */
router.put(
  '/:id/confirm-cash-payment',
  authorize(UserRole.OWNER, UserRole.ADMIN),
  reservationController.confirmCashPayment
);

/**
 * Obtener reservas de un estacionamiento específico
 * GET /v1/reservations/parking/:parkingId?status=confirmed&startDate=xxx
 */
router.get(
  '/parking/:parkingId',
  authorize(UserRole.OWNER, UserRole.ADMIN),
  reservationController.getParkingReservations
);

export default router;
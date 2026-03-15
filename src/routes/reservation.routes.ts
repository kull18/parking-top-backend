import { Router } from 'express';
import reservationController from '@/controllers/reservation.controller';
import { authenticate } from '@/middlewares/auth.middleware';
import { validateRequest } from '@/middlewares/validation.middleware';
import { createReservationSchema } from '@/utils/validators';

const router = Router();

router.use(authenticate);

router.post('/', validateRequest(createReservationSchema), reservationController.create);
router.post('/:reservationId/payment', reservationController.processPayment);
router.post('/:reservationId/confirm', reservationController.confirmReservation);
router.post('/:reservationId/checkin', reservationController.checkIn);
router.post('/:reservationId/checkout', reservationController.checkOut);
router.post('/:reservationId/cancel', reservationController.cancel);
router.get('/my-reservations', reservationController.getUserReservations);
router.post('/:id/pay-overtime', reservationController.payOvertime.bind(reservationController));
router.get('/:id', reservationController.getById);

export default router;
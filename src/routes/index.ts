import { Router } from 'express';
import authRoutes from './auth.routes';
import userRoutes from './user.routes';
import subscriptionRoutes from './subscription.routes';
import parkingRoutes from './parking.routes';
import reservationRoutes from './reservation.routes';
import paymentRoutes from './payment.routes';
import reviewRoutes from './review.routes';

const router = Router();

// Registrar todas las rutas
router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/subscriptions', subscriptionRoutes);
router.use('/parkings', parkingRoutes);
router.use('/reservations', reservationRoutes);
router.use('/payments', paymentRoutes);
router.use('/reviews', reviewRoutes);

export default router;
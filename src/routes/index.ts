import { Router } from 'express';
import authRoutes from './auth.routes';
import userRoutes from './user.routes';
import subscriptionRoutes from './subscription.routes';
import parkingRoutes from './parking.routes';
import reservationRoutes from './reservation.routes';
import paymentRoutes from './payment.routes';
import payoutRoutes from './payout.routes';
import reviewRoutes from './review.routes';
import notificationRoutes from './notification.routes';
import dashboardRoutes from './dashboard.routes';
import mapsRoutes from './maps.routes';

const router = Router();

// Registrar todas las rutas
router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/subscriptions', subscriptionRoutes);
router.use('/parkings', parkingRoutes);
router.use('/reservations', reservationRoutes);
router.use('/payments', paymentRoutes);
router.use('/payouts', payoutRoutes);
router.use('/reviews', reviewRoutes);
router.use('/notifications', notificationRoutes);
router.use('/dashboard', dashboardRoutes);
router.use('/maps', mapsRoutes);

export default router;
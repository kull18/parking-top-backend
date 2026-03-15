import { Router } from 'express';
import paymentController from '@/controllers/payment.controller';
import { authenticate } from '@/middlewares/auth.middleware';

const router = Router();

router.use(authenticate);

router.get('/my-payments', paymentController.getUserPayments.bind(paymentController));
router.get('/stats', paymentController.getPaymentStats.bind(paymentController));
router.get('/status/:transactionId', paymentController.getPaymentStatus.bind(paymentController));
router.get('/:id', paymentController.getPaymentById.bind(paymentController));
router.post('/create-intent', paymentController.createPaymentIntent.bind(paymentController));
router.post('/confirm', paymentController.confirmPayment.bind(paymentController));

export default router;
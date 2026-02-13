import { Router } from 'express';
import subscriptionController from '@/controllers/subscription.controller';
import { authenticate, authorize } from '@/middlewares/auth.middleware';
import { validateRequest } from '@/middlewares/validation.middleware';
import { subscriptionLimiter } from '@/middlewares/rate-limit.middleware';
import { createSubscriptionSchema } from '@/utils/validators';
import { UserRole } from '@/types/enums';

const router = Router();

// Ruta pública
router.get('/plans', subscriptionController.getPlans);

// Rutas protegidas (solo propietarios)
router.use(authenticate);
router.use(authorize(UserRole.OWNER));

router.post(
  '/create',
  subscriptionLimiter,
  validateRequest(createSubscriptionSchema),
  subscriptionController.createSubscription
);
router.get('/current', subscriptionController.getCurrentSubscription);
router.post('/:subscriptionId/change-plan', subscriptionController.changePlan);
router.post('/:subscriptionId/cancel', subscriptionController.cancelSubscription);
router.post('/:subscriptionId/update-payment-method', subscriptionController.updatePaymentMethod);
router.post('/:subscriptionId/reactivate', subscriptionController.reactivateSubscription);
router.get('/:subscriptionId/invoices', subscriptionController.getInvoices);

export default router;
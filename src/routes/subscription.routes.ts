import { Router } from 'express';
import subscriptionController from '@/controllers/subscription.controller';
import { authenticate } from '@/middlewares/auth.middleware';
import { authorize } from '@/middlewares/role.middleware';
import { UserRole } from '@/types/enums';

const router = Router();

// Rutas públicas

router.get('/success', (req, res) => {
  // MercadoPago redirige aquí con ?status=approved|rejected|pending
  const { status, preapproval_id } = req.query;
 
  // Redirige a la app con un deep link
  const appDeepLink = `parkingtop://subscription/${status || 'success'}?id=${preapproval_id || ''}`;
 
  // En producción redirige al deep link de la app
  // En desarrollo muestra un mensaje simple
  res.redirect(appDeepLink);
});
 
router.get('/plans', subscriptionController.getPlans.bind(subscriptionController));

// Rutas protegidas (solo propietarios)
router.use(authenticate);
router.use(authorize(UserRole.OWNER));

router.get('/my-subscription', subscriptionController.getMySubscription.bind(subscriptionController));
router.post('/', subscriptionController.create.bind(subscriptionController));
router.put('/plan', subscriptionController.updatePlan.bind(subscriptionController));
router.post('/cancel', subscriptionController.cancel.bind(subscriptionController));
router.post('/reactivate', subscriptionController.reactivate.bind(subscriptionController));

export default router;
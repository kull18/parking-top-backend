// src/routes/payout.routes.ts
import { Router } from 'express';
import payoutController from '@/controllers/payout.controller';
import { authenticate } from '@/middlewares/auth.middleware';
import { authorize } from '@/middlewares/role.middleware';
import { UserRole } from '@/types/enums';

const router = Router();

// ✅ Aplicar autenticación a TODAS las rutas
router.use(authenticate);

// ─────────────────────────────────────────
// RUTAS DE PROPIETARIOS (owner)
// ─────────────────────────────────────────

router.get('/balance', 
  authorize(UserRole.OWNER),
  payoutController.getBalance.bind(payoutController)
);

router.post('/request', 
  authorize(UserRole.OWNER),
  payoutController.requestPayout.bind(payoutController)
);

router.get('/history', 
  authorize(UserRole.OWNER),
  payoutController.getHistory.bind(payoutController)
);

// ─────────────────────────────────────────
// RUTAS DE ADMIN
// ─────────────────────────────────────────

router.get('/stats', 
  authorize(UserRole.ADMIN),
  payoutController.getStats.bind(payoutController)
);

router.get('/balance-stats', 
  authorize(UserRole.ADMIN),
  payoutController.getBalanceStats.bind(payoutController)
);

router.get('/top-earners', 
  authorize(UserRole.ADMIN),
  payoutController.getTopEarners.bind(payoutController)
);

router.put('/:id/approve', 
  authorize(UserRole.ADMIN),
  payoutController.approve.bind(payoutController)
);

router.put('/:id/reject', 
  authorize(UserRole.ADMIN),
  payoutController.reject.bind(payoutController)
);

// ─────────────────────────────────────────
// RUTAS COMPARTIDAS (owner puede ver su payout, admin puede ver todos)
// ─────────────────────────────────────────

router.get('/:id', 
  authorize(UserRole.OWNER, UserRole.ADMIN),
  payoutController.getById.bind(payoutController)
);

router.get('/', 
  authorize(UserRole.ADMIN),
  payoutController.getAll.bind(payoutController)
);

export default router;
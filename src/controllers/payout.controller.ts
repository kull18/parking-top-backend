// src/controllers/payout.controller.ts
import { Response, NextFunction } from 'express';
import { AuthRequest } from '@/types/interfaces';
import payoutService from '@/services/payout.service';
import balanceService from '@/services/balance.service';
import { sendSuccess, sendError } from '@/utils/response';
import logger from '@/utils/logger';
import { z } from 'zod';

const requestPayoutSchema = z.object({
  amount: z.number().min(100, 'El monto mínimo es $100 MXN'),
  bankAccount: z.string().optional(),
  accountHolder: z.string().optional(),
  notes: z.string().optional()
});

const rejectPayoutSchema = z.object({
  reason: z.string().min(10, 'Proporciona un motivo de al menos 10 caracteres')
});

export class PayoutController {

  /**
   * Ver balance del propietario
   * GET /payouts/balance
   */
  async getBalance(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const balance = await balanceService.getOwnerBalance(userId);
      sendSuccess(res, balance);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Solicitar retiro
   * POST /payouts/request
   */
  async requestPayout(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const data = requestPayoutSchema.parse(req.body);

      const payout = await payoutService.requestPayout(userId, data);
      sendSuccess(res, payout, 201);
    } catch (error: any) {
      logger.error('Error requesting payout:', error);

      if (error.message === 'ONLY_OWNERS_CAN_REQUEST_PAYOUTS') {
        sendError(res, 'FORBIDDEN', 'Solo los propietarios pueden solicitar retiros', 403);
      } else if (error.message === 'MINIMUM_PAYOUT_AMOUNT') {
        sendError(res, 'INVALID_AMOUNT', 'El monto mínimo de retiro es $100 MXN', 400);
      } else if (error.message === 'INSUFFICIENT_BALANCE') {
        sendError(res, 'INSUFFICIENT_BALANCE', 'Saldo insuficiente', 400);
      } else if (error instanceof z.ZodError) {
        sendError(res, 'VALIDATION_ERROR', error.errors[0].message, 400);
      } else {
        next(error);
      }
    }
  }

  /**
   * Ver historial de payouts del propietario
   * GET /payouts/history
   */
  async getHistory(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const { page = '1', perPage = '20' } = req.query;

      const result = await payoutService.getOwnerPayouts(
        userId,
        parseInt(page as string, 10),
        parseInt(perPage as string, 10)
      );

      sendSuccess(res, result);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Listar todos los payouts (admin)
   * GET /payouts
   */
  async getAll(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { page = '1', perPage = '20', status } = req.query;

      const result = await payoutService.getAllPayouts(
        parseInt(page as string, 10),
        parseInt(perPage as string, 10),
        status as any
      );

      sendSuccess(res, result);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Ver detalles de un payout
   * GET /payouts/:id
   */
  async getById(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const userId = req.user!.role === 'admin' ? undefined : req.user!.userId;

      const payout = await payoutService.getPayoutById(id, userId);
      sendSuccess(res, payout);
    } catch (error: any) {
      if (error.message === 'PAYOUT_NOT_FOUND') {
        sendError(res, 'NOT_FOUND', 'Payout no encontrado', 404);
      } else if (error.message === 'UNAUTHORIZED') {
        sendError(res, 'FORBIDDEN', 'No tienes permiso para ver este payout', 403);
      } else {
        next(error);
      }
    }
  }

  /**
   * Aprobar payout (admin)
   * PUT /payouts/:id/approve
   */
  async approve(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const adminId = req.user!.userId;

      const payout = await payoutService.approvePayout(id, adminId);
      sendSuccess(res, payout);
    } catch (error: any) {
      if (error.message === 'PAYOUT_NOT_FOUND') {
        sendError(res, 'NOT_FOUND', 'Payout no encontrado', 404);
      } else if (error.message === 'PAYOUT_NOT_PENDING') {
        sendError(res, 'INVALID_STATUS', 'El payout no está pendiente', 400);
      } else {
        next(error);
      }
    }
  }

  /**
   * Rechazar payout (admin)
   * PUT /payouts/:id/reject
   */
  async reject(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const adminId = req.user!.userId;
      const { reason } = rejectPayoutSchema.parse(req.body);

      const payout = await payoutService.rejectPayout(id, adminId, reason);
      sendSuccess(res, payout);
    } catch (error: any) {
      if (error.message === 'PAYOUT_NOT_FOUND') {
        sendError(res, 'NOT_FOUND', 'Payout no encontrado', 404);
      } else if (error.message === 'PAYOUT_NOT_PENDING') {
        sendError(res, 'INVALID_STATUS', 'El payout no está pendiente', 400);
      } else if (error instanceof z.ZodError) {
        sendError(res, 'VALIDATION_ERROR', error.errors[0].message, 400);
      } else {
        next(error);
      }
    }
  }

  /**
   * Obtener estadísticas de payouts (admin)
   * GET /payouts/stats
   */
  async getStats(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const stats = await payoutService.getPayoutStats();
      sendSuccess(res, stats);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Obtener estadísticas de balances (admin)
   * GET /payouts/balance-stats
   */
  async getBalanceStats(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const stats = await balanceService.getBalanceStats();
      sendSuccess(res, stats);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Obtener top propietarios por ganancias (admin)
   * GET /payouts/top-earners
   */
  async getTopEarners(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { limit = '10' } = req.query;
      const topEarners = await balanceService.getTopEarners(parseInt(limit as string, 10));
      sendSuccess(res, topEarners);
    } catch (error) {
      next(error);
    }
  }
}

export default new PayoutController();
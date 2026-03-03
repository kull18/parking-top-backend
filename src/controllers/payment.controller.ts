import { Response, NextFunction } from 'express';
import { AuthRequest } from '@/types/interfaces';
import paymentService from '@/services/payment.service';
import { sendSuccess, sendError } from '@/utils/response';

export class PaymentController {
  
  async getUserPayments(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;

      const payments = await paymentService.getUserPayments(userId);

      sendSuccess(res, payments);
    } catch (error) {
      next(error);
    }
  }

  async getPaymentById(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;

      const payment = await paymentService.getPaymentById(id);

      if (!payment) {
        sendError(res, 'NOT_FOUND', 'Pago no encontrado', 404);
        return;
      }

      sendSuccess(res, payment);
    } catch (error) {
      next(error);
    }
  }

  async getPaymentStatus(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { transactionId } = req.params;

      const status = await paymentService.getPaymentStatus(transactionId);

      sendSuccess(res, status);
    } catch (error: any) {
      sendError(res, 'PAYMENT_STATUS_ERROR', error.message, 400);
    }
  }

  async getPaymentStats(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;

      const stats = await paymentService.getPaymentStats(userId);

      sendSuccess(res, stats);
    } catch (error) {
      next(error);
    }
  }
}

export default new PaymentController();
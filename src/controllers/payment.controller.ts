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

  async createPaymentIntent(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const { amount, paymentType, reservationId, subscriptionId } = req.body;

      const result = await paymentService.createPaymentIntent(
        userId,
        amount,
        paymentType,
        reservationId,
        subscriptionId
      );

      sendSuccess(res, result);
    } catch (error: any) {
      sendError(res, 'PAYMENT_INTENT_ERROR', error.message, 400);
    }
  }

  async confirmPayment(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { paymentIntentId } = req.body;

      const result = await paymentService.confirmPayment(paymentIntentId);

      sendSuccess(res, result);
    } catch (error: any) {
      sendError(res, 'PAYMENT_CONFIRMATION_ERROR', error.message, 400);
    }
  }
}

export default new PaymentController();
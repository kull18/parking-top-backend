import { Response, NextFunction } from 'express';
import { AuthRequest } from '@/types/interfaces';
import subscriptionService from '@/services/subscription.service';
import prisma from '@/config/database';
import { sendSuccess, sendError } from '@/utils/response';
import logger from '@/utils/logger';

export class SubscriptionController {
  
  async getPlans(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const plans = await prisma.subscriptionPlan.findMany({
        where: { isActive: true },
        orderBy: { monthlyPrice: 'asc' }
      });

      sendSuccess(res, plans);
    } catch (error) {
      next(error);
    }
  }

  async createSubscription(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { planId, paymentMethodId } = req.body;
      const userId = req.user!.userId;

      const subscription = await subscriptionService.createSubscription(userId, {
        planId,
        paymentMethodId
      });

      sendSuccess(res, subscription, 201);
    } catch (error: any) {
      logger.error('Error creating subscription:', error);
      sendError(res, 'SUBSCRIPTION_ERROR', error.message, 400);
    }
  }

  async getCurrentSubscription(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      
      const subscription = await subscriptionService.getActiveSubscription(userId);

      if (!subscription) {
        sendError(res, 'NO_SUBSCRIPTION', 'No tienes una suscripción activa', 404);
        return;
      }

      sendSuccess(res, subscription);
    } catch (error) {
      next(error);
    }
  }

  async changePlan(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { subscriptionId } = req.params;
      const { newPlanId } = req.body;

      const subscription = await subscriptionService.changePlan(subscriptionId, newPlanId);

      sendSuccess(res, subscription);
    } catch (error: any) {
      sendError(res, 'PLAN_CHANGE_ERROR', error.message, 400);
    }
  }

  async cancelSubscription(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { subscriptionId } = req.params;
      const { cancelAtPeriodEnd, reason } = req.body;

      await subscriptionService.cancelSubscription(
        subscriptionId,
        cancelAtPeriodEnd ?? true,
        reason
      );

      sendSuccess(res, { message: 'Suscripción cancelada exitosamente' });
    } catch (error: any) {
      sendError(res, 'CANCEL_ERROR', error.message, 400);
    }
  }

  async updatePaymentMethod(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { subscriptionId } = req.params;
      const { paymentMethodId } = req.body;

      await subscriptionService.reactivateSubscription(subscriptionId, paymentMethodId);

      sendSuccess(res, { message: 'Método de pago actualizado' });
    } catch (error: any) {
      sendError(res, 'PAYMENT_METHOD_ERROR', error.message, 400);
    }
  }

  async getInvoices(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { subscriptionId } = req.params;

      const invoices = await prisma.subscriptionInvoice.findMany({
        where: { subscriptionId },
        orderBy: { createdAt: 'desc' }
      });

      sendSuccess(res, invoices);
    } catch (error) {
      next(error);
    }
  }

  async reactivateSubscription(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { subscriptionId } = req.params;
      const { paymentMethodId } = req.body;

      await subscriptionService.reactivateSubscription(subscriptionId, paymentMethodId);

      sendSuccess(res, { message: 'Suscripción reactivada exitosamente' });
    } catch (error: any) {
      sendError(res, 'REACTIVATION_ERROR', error.message, 400);
    }
  }
}

export default new SubscriptionController();
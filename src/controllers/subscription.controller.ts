import { Response, NextFunction } from 'express';
import { AuthRequest } from '@/types/interfaces';
import subscriptionService from '@/services/subscription.service.mercadopago';
import { sendSuccess, sendError } from '@/utils/response';
import logger from '@/utils/logger';

export class SubscriptionController {

  async getPlans(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const plans = await subscriptionService.getPlans();
      sendSuccess(res, plans);
    } catch (error) {
      next(error);
    }
  }

  async getMySubscription(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const subscription = await subscriptionService.getUserSubscription(userId);
      sendSuccess(res, subscription);
    } catch (error: any) {
      if (error.message === 'SUBSCRIPTION_NOT_FOUND') {
        sendError(res, 'SUBSCRIPTION_NOT_FOUND', 'No tienes una suscripción activa', 404);
      } else {
        next(error);
      }
    }
  }

  async create(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const { planId } = req.body;

      const result = await subscriptionService.createSubscription(userId, { planId });
      sendSuccess(res, result, 201);
    } catch (error: any) {
      logger.error('Error creating subscription:', error);
      
      if (error.message === 'ALREADY_SUBSCRIBED') {
        sendError(res, 'ALREADY_SUBSCRIBED', 'Ya tienes una suscripción activa', 400);
      } else if (error.message === 'PLAN_NOT_FOUND') {
        sendError(res, 'PLAN_NOT_FOUND', 'Plan no encontrado', 404);
      } else {
        sendError(res, 'SUBSCRIPTION_ERROR', 'Error al crear suscripción', 400);
      }
    }
  }

  async updatePlan(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const { planId } = req.body;

      const subscription = await subscriptionService.updateSubscriptionPlan(userId, planId);
      sendSuccess(res, subscription);
    } catch (error: any) {
      if (error.message === 'SUBSCRIPTION_NOT_FOUND') {
        sendError(res, 'SUBSCRIPTION_NOT_FOUND', 'No tienes una suscripción activa', 404);
      } else if (error.message === 'SUBSCRIPTION_NOT_ACTIVE') {
        sendError(res, 'SUBSCRIPTION_NOT_ACTIVE', 'Tu suscripción no está activa', 400);
      } else {
        next(error);
      }
    }
  }

  async cancel(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const { cancelAtPeriodEnd, cancellationReason } = req.body;

      const subscription = await subscriptionService.cancelSubscription(userId, {
        cancelAtPeriodEnd,
        cancellationReason
      });
      sendSuccess(res, subscription);
    } catch (error: any) {
      if (error.message === 'SUBSCRIPTION_NOT_FOUND') {
        sendError(res, 'SUBSCRIPTION_NOT_FOUND', 'No tienes una suscripción activa', 404);
      } else {
        next(error);
      }
    }
  }

  async reactivate(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const subscription = await subscriptionService.reactivateSubscription(userId);
      sendSuccess(res, subscription);
    } catch (error: any) {
      if (error.message === 'SUBSCRIPTION_NOT_FOUND') {
        sendError(res, 'SUBSCRIPTION_NOT_FOUND', 'No tienes una suscripción', 404);
      } else {
        next(error);
      }
    }
  }
}

export default new SubscriptionController();
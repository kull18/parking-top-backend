// src/webhooks/mercadopago.webhook.ts
import { Router, Request, Response } from 'express';
import paymentService from '@/services/payment.service';
import subscriptionService from '@/services/subscription.service.mercadopago';
import subscriptionRepository from '@/repositories/subscription.repository';
import notificationService from '@/services/notification.service';
import mercadopagoService from '@/integrations/mercadopago.client';
import { SubscriptionStatus } from '@/types/enums';
import { config } from '@/config/environment';
import logger from '@/utils/logger';
import crypto from 'crypto';
import prisma from '@/config/database';

const router = Router();

const validateMPSignature = (req: Request): boolean => {
  try {
    const signature = req.headers['x-signature'] as string;
    const requestId = req.headers['x-request-id'] as string;

    if (!signature || !config.mercadopago.webhookSecret) return true; // skip en dev

    const [tsPart, v1Part] = signature.split(',');
    const ts = tsPart?.split('=')[1];
    const v1 = v1Part?.split('=')[1];

    const dataId = req.body?.data?.id;
    const manifest = `id:${dataId};request-id:${requestId};ts:${ts};`;

    const expected = crypto
      .createHmac('sha256', config.mercadopago.webhookSecret)
      .update(manifest)
      .digest('hex');

    return expected === v1;
  } catch {
    return false;
  }
};

router.post('/', async (req: Request, res: Response) => {
  // MP requiere 200 inmediato siempre
  res.sendStatus(200);

  try {
    const { type, action, data } = req.body;

    logger.info(`MP Webhook received: type=${type} action=${action} id=${data?.id}`);

    if (!validateMPSignature(req)) {
      logger.warn('Invalid MercadoPago webhook signature');
      return;
    }

    // PAGOS DE RESERVAS/OVERTIME
    if (type === 'payment') {
      if (action === 'payment.updated' || action === 'payment.created') {
        await paymentService.confirmPayment(String(data.id));
      }
    }

    // SUSCRIPCIONES - PreApproval
    if (type === 'subscription_preapproval') {
      if (action === 'created' || action === 'updated') {
        await processSubscription(data.id, action);
      }
    }

    // PAGOS AUTORIZADOS DE SUSCRIPCIÓN
    if (type === 'subscription_authorized_payment') {
      await processSubscriptionPayment(data.id);
    }

  } catch (error) {
    logger.error('Error processing MP webhook:', error);
    // No lanzar error — MP reintentaría infinitamente
  }
});

/**
 * Procesar eventos de suscripción (PreApproval)
 */
async function processSubscription(preapprovalId: string, action: string): Promise<void> {
  try {
    logger.info(`Processing subscription: ${preapprovalId} - ${action}`);

    // Obtener info de MercadoPago
    const mpSubscription = await mercadopagoService.getSubscription(preapprovalId);

    // Buscar suscripción en BD
    const subscription = await subscriptionRepository.findByMpPreapprovalId(preapprovalId);

    if (!subscription) {
      logger.warn(`Subscription not found for preapproval ${preapprovalId}`);
      return;
    }

    // Actualizar según estado de MercadoPago
    if (mpSubscription.status === 'authorized') {
      // Suscripción aprobada
      const now = new Date();
      const nextPeriodEnd = new Date();
      nextPeriodEnd.setMonth(nextPeriodEnd.getMonth() + 1);

      await subscriptionRepository.update(subscription.id, {
        status: SubscriptionStatus.ACTIVE,
        currentPeriodStart: now,
        currentPeriodEnd: nextPeriodEnd
      });

      // Notificar usuario
      await notificationService.create({
        userId: subscription.userId,
        type: 'subscription_created' as any,
        title: '¡Suscripción activada!',
        message: `Tu plan ${subscription.plan.displayName} está activo. ${subscription.plan.trialDays > 0 ? `Disfruta ${subscription.plan.trialDays} días gratis.` : ''}`,
        subscriptionId: subscription.id
      });

      logger.info(`Subscription activated: ${subscription.id}`);
    } 
    else if (mpSubscription.status === 'cancelled') {
      // Suscripción cancelada
      await subscriptionRepository.update(subscription.id, {
        status: SubscriptionStatus.CANCELLED,
        endedAt: new Date()
      });

      logger.info(`Subscription cancelled: ${subscription.id}`);
    }
    else if (mpSubscription.status === 'paused') {
      // Suscripción pausada
      await subscriptionRepository.update(subscription.id, {
        status: SubscriptionStatus.PAST_DUE
      });

      logger.info(`Subscription paused: ${subscription.id}`);
    }
  } catch (error) {
    logger.error(`Error processing subscription ${preapprovalId}:`, error);
    throw error;
  }
}

/**
 * Procesar pago de suscripción (cobro mensual recurrente)
 */
async function processSubscriptionPayment(paymentId: string): Promise<void> {
  try {
    logger.info(`Processing subscription payment: ${paymentId}`);

    const payment = await mercadopagoService.getPayment(paymentId);

    // Buscar suscripción por preapproval_id
    const preapprovalId = (payment as any).preapproval_id;
    if (!preapprovalId) {
      logger.warn(`Payment ${paymentId} has no preapproval_id`);
      return;
    }

    const subscription = await subscriptionRepository.findByMpPreapprovalId(preapprovalId);
    if (!subscription) {
      logger.warn(`Subscription not found for preapproval ${preapprovalId}`);
      return;
    }

    if (payment.status === 'approved') {
      // Pago aprobado - renovar período
      const now = new Date();
      const nextPeriodEnd = new Date();
      nextPeriodEnd.setMonth(nextPeriodEnd.getMonth() + 1);

      await subscriptionRepository.update(subscription.id, {
        status: SubscriptionStatus.ACTIVE,
        currentPeriodStart: now,
        currentPeriodEnd: nextPeriodEnd
      });

      // Crear registro de invoice
      await prisma.subscriptionInvoice.create({
        data: {
          subscriptionId: subscription.id,
          mpPaymentId: paymentId,
          amount: payment.transaction_amount || 0,
          status: 'paid',
          paidAt: new Date(),
          periodStart: now,
          periodEnd: nextPeriodEnd
        }
      });

      // Notificar
      await notificationService.sendPaymentReceived(
        subscription.userId,
        payment.transaction_amount || 0
      );

      logger.info(`Subscription payment processed: ${paymentId}`);
    } 
    else if (payment.status === 'rejected') {
      // Pago rechazado
      await subscriptionService.markSubscriptionPaymentFailed(subscription.id);
    }
  } catch (error) {
    logger.error(`Error processing subscription payment ${paymentId}:`, error);
    throw error;
  }
}

export default router;
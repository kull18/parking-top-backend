// src/webhooks/mercadopago.webhook.ts
import { Router, Request, Response } from 'express';
import paymentService from '@/services/payment.service';
import { config } from '@/config/environment';
import logger from '@/utils/logger';
import crypto from 'crypto';

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

    if (type === 'payment') {
      if (action === 'payment.updated' || action === 'payment.created') {
        await paymentService.confirmPayment(String(data.id));
      }
    }

    // Para suscripciones (cuando las integres)
    if (type === 'subscription_preapproval') {
      logger.info(`Subscription webhook: ${action} - ${data?.id}`);
      // await subscriptionService.handleMPWebhook(data.id, action);
    }

  } catch (error) {
    logger.error('Error processing MP webhook:', error);
    // No lanzar error — MP reintentaría infinitamente
  }
});

export default router;
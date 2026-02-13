import Stripe from 'stripe';
import { config } from '@/config/environment';
import logger from '@/utils/logger';

if (!config.stripe.secretKey) {
  throw new Error('STRIPE_SECRET_KEY no está configurado');
}

const stripeClient = new Stripe(config.stripe.secretKey, {
  apiVersion: '2023-10-16',
  typescript: true
});

export class StripeService {
  
  async createPaymentIntent(amount: number, metadata?: Record<string, string>) {
    try {
      return await stripeClient.paymentIntents.create({
        amount: Math.round(amount * 100),
        currency: config.stripe.currency,
        metadata,
        automatic_payment_methods: {
          enabled: true
        }
      });
    } catch (error) {
      logger.error('Error creating payment intent:', error);
      throw error;
    }
  }

  async confirmPayment(paymentIntentId: string) {
    try {
      return await stripeClient.paymentIntents.confirm(paymentIntentId);
    } catch (error) {
      logger.error('Error confirming payment:', error);
      throw error;
    }
  }

  async createCustomer(email: string, name: string, metadata?: Record<string, string>) {
    try {
      return await stripeClient.customers.create({
        email,
        name,
        metadata
      });
    } catch (error) {
      logger.error('Error creating customer:', error);
      throw error;
    }
  }

  async createSubscription(
    customerId: string,
    priceId: string,
    trialDays?: number,
    paymentMethodId?: string
  ) {
    try {
      const subscriptionData: Stripe.SubscriptionCreateParams = {
        customer: customerId,
        items: [{ price: priceId }],
        payment_behavior: 'default_incomplete',
        expand: ['latest_invoice.payment_intent']
      };

      if (trialDays && trialDays > 0) {
        subscriptionData.trial_period_days = trialDays;
      }

      if (paymentMethodId) {
        subscriptionData.default_payment_method = paymentMethodId;
      }

      return await stripeClient.subscriptions.create(subscriptionData);
    } catch (error) {
      logger.error('Error creating subscription:', error);
      throw error;
    }
  }

  async updateSubscription(subscriptionId: string, params: Stripe.SubscriptionUpdateParams) {
    try {
      return await stripeClient.subscriptions.update(subscriptionId, params);
    } catch (error) {
      logger.error('Error updating subscription:', error);
      throw error;
    }
  }

  async cancelSubscription(subscriptionId: string, cancelAtPeriodEnd: boolean = true) {
    try {
      if (cancelAtPeriodEnd) {
        return await stripeClient.subscriptions.update(subscriptionId, {
          cancel_at_period_end: true
        });
      } else {
        return await stripeClient.subscriptions.cancel(subscriptionId);
      }
    } catch (error) {
      logger.error('Error canceling subscription:', error);
      throw error;
    }
  }

  async attachPaymentMethod(paymentMethodId: string, customerId: string) {
    try {
      return await stripeClient.paymentMethods.attach(paymentMethodId, {
        customer: customerId
      });
    } catch (error) {
      logger.error('Error attaching payment method:', error);
      throw error;
    }
  }

  async verifyWebhookSignature(payload: string | Buffer, signature: string) {
    try {
      return stripeClient.webhooks.constructEvent(
        payload,
        signature,
        config.stripe.webhookSecret
      );
    } catch (error) {
      logger.error('Error verifying webhook signature:', error);
      throw error;
    }
  }
}

export default stripeClient;
export const stripeService = new StripeService();
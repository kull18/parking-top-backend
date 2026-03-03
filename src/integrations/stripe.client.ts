import Stripe from 'stripe';
import { config } from '@/config/environment';
import logger from '@/utils/logger';

const stripe = new Stripe(config.stripe.secretKey, {
  apiVersion: '2023-10-16',
  typescript: true
});

export class StripeService {

  // ========== CUSTOMERS ==========

  async createCustomer(data: {
    email: string;
    name: string;
    metadata?: Record<string, string>;
  }): Promise<Stripe.Customer> {
    try {
      const customer = await stripe.customers.create({
        email: data.email,
        name: data.name,
        metadata: data.metadata || {}
      });

      logger.info(`Stripe customer created: ${customer.id}`);
      return customer;
    } catch (error) {
      logger.error('Error creating Stripe customer:', error);
      throw error;
    }
  }

  async getCustomer(customerId: string): Promise<Stripe.Customer> {
    return await stripe.customers.retrieve(customerId) as Stripe.Customer;
  }

  async updateCustomer(customerId: string, data: {
    email?: string;
    name?: string;
    metadata?: Record<string, string>;
  }): Promise<Stripe.Customer> {
    return await stripe.customers.update(customerId, data);
  }

  async deleteCustomer(customerId: string): Promise<Stripe.DeletedCustomer> {
    return await stripe.customers.del(customerId);
  }

  // ========== PAYMENT METHODS ==========

  async attachPaymentMethod(
    paymentMethodId: string,
    customerId: string
  ): Promise<Stripe.PaymentMethod> {
    return await stripe.paymentMethods.attach(paymentMethodId, {
      customer: customerId
    });
  }

  async setDefaultPaymentMethod(
    customerId: string,
    paymentMethodId: string
  ): Promise<Stripe.Customer> {
    return await stripe.customers.update(customerId, {
      invoice_settings: {
        default_payment_method: paymentMethodId
      }
    });
  }

  async listPaymentMethods(customerId: string): Promise<Stripe.PaymentMethod[]> {
    const paymentMethods = await stripe.paymentMethods.list({
      customer: customerId,
      type: 'card'
    });

    return paymentMethods.data;
  }

  async detachPaymentMethod(paymentMethodId: string): Promise<Stripe.PaymentMethod> {
    return await stripe.paymentMethods.detach(paymentMethodId);
  }

  // ========== SUBSCRIPTIONS ==========

  async createSubscription(data: {
    customerId: string;
    priceId: string;
    trialDays?: number;
    metadata?: Record<string, string>;
  }): Promise<Stripe.Subscription> {
    try {
      const subscriptionData: Stripe.SubscriptionCreateParams = {
        customer: data.customerId,
        items: [{ price: data.priceId }],
        payment_behavior: 'default_incomplete',
        payment_settings: {
          save_default_payment_method: 'on_subscription'
        },
        expand: ['latest_invoice.payment_intent'],
        metadata: data.metadata || {}
      };

      if (data.trialDays && data.trialDays > 0) {
        subscriptionData.trial_period_days = data.trialDays;
      }

      const subscription = await stripe.subscriptions.create(subscriptionData);

      logger.info(`Stripe subscription created: ${subscription.id}`);
      return subscription;
    } catch (error) {
      logger.error('Error creating Stripe subscription:', error);
      throw error;
    }
  }

  async getSubscription(subscriptionId: string): Promise<Stripe.Subscription> {
    return await stripe.subscriptions.retrieve(subscriptionId);
  }

  async updateSubscription(
    subscriptionId: string,
    data: {
      priceId?: string;
      metadata?: Record<string, string>;
    }
  ): Promise<Stripe.Subscription> {
    const updateData: Stripe.SubscriptionUpdateParams = {};

    if (data.priceId) {
      updateData.items = [{ price: data.priceId }];
      updateData.proration_behavior = 'always_invoice';
    }

    if (data.metadata) {
      updateData.metadata = data.metadata;
    }

    return await stripe.subscriptions.update(subscriptionId, updateData);
  }

  async cancelSubscription(
    subscriptionId: string,
    cancelAtPeriodEnd: boolean = true
  ): Promise<Stripe.Subscription> {
    if (cancelAtPeriodEnd) {
      return await stripe.subscriptions.update(subscriptionId, {
        cancel_at_period_end: true
      });
    } else {
      return await stripe.subscriptions.cancel(subscriptionId);
    }
  }

  async reactivateSubscription(subscriptionId: string): Promise<Stripe.Subscription> {
    return await stripe.subscriptions.update(subscriptionId, {
      cancel_at_period_end: false
    });
  }

  // ========== PAYMENT INTENTS (para reservas) ==========

  async createPaymentIntent(data: {
    amount: number;
    currency?: string;
    customerId?: string;
    metadata?: Record<string, string>;
  }): Promise<Stripe.PaymentIntent> {
    try {
      const paymentIntent = await stripe.paymentIntents.create({
        amount: Math.round(data.amount * 100), // convertir a centavos
        currency: data.currency || 'mxn',
        customer: data.customerId,
        automatic_payment_methods: {
          enabled: true
        },
        metadata: data.metadata || {}
      });

      logger.info(`Payment intent created: ${paymentIntent.id}`);
      return paymentIntent;
    } catch (error) {
      logger.error('Error creating payment intent:', error);
      throw error;
    }
  }

  async confirmPaymentIntent(paymentIntentId: string): Promise<Stripe.PaymentIntent> {
    return await stripe.paymentIntents.confirm(paymentIntentId);
  }

  async cancelPaymentIntent(paymentIntentId: string): Promise<Stripe.PaymentIntent> {
    return await stripe.paymentIntents.cancel(paymentIntentId);
  }

  async getPaymentIntent(paymentIntentId: string): Promise<Stripe.PaymentIntent> {
    return await stripe.paymentIntents.retrieve(paymentIntentId);
  }

  // ========== REFUNDS ==========

  async createRefund(data: {
    paymentIntentId: string;
    amount?: number;
    reason?: 'duplicate' | 'fraudulent' | 'requested_by_customer';
  }): Promise<Stripe.Refund> {
    const refundData: Stripe.RefundCreateParams = {
      payment_intent: data.paymentIntentId
    };

    if (data.amount) {
      refundData.amount = Math.round(data.amount * 100);
    }

    if (data.reason) {
      refundData.reason = data.reason;
    }

    const refund = await stripe.refunds.create(refundData);

    logger.info(`Refund created: ${refund.id}`);
    return refund;
  }

  // ========== PRICES (para planes de suscripción) ==========

  async createPrice(data: {
    productId: string;
    unitAmount: number;
    currency?: string;
    recurring?: {
      interval: 'month' | 'year';
      intervalCount?: number;
    };
  }): Promise<Stripe.Price> {
    return await stripe.prices.create({
      product: data.productId,
      unit_amount: Math.round(data.unitAmount * 100),
      currency: data.currency || 'mxn',
      recurring: data.recurring
    });
  }

  async getPrice(priceId: string): Promise<Stripe.Price> {
    return await stripe.prices.retrieve(priceId);
  }

  // ========== PRODUCTS ==========

  async createProduct(data: {
    name: string;
    description?: string;
    metadata?: Record<string, string>;
  }): Promise<Stripe.Product> {
    return await stripe.products.create({
      name: data.name,
      description: data.description,
      metadata: data.metadata || {}
    });
  }

  // ========== WEBHOOKS ==========

  constructWebhookEvent(
    payload: string | Buffer,
    signature: string,
    secret: string
  ): Stripe.Event {
    return stripe.webhooks.constructEvent(payload, signature, secret);
  }

  // ========== INVOICES ==========

  async getInvoice(invoiceId: string): Promise<Stripe.Invoice> {
    return await stripe.invoices.retrieve(invoiceId);
  }

  async listInvoices(customerId: string, limit: number = 10): Promise<Stripe.Invoice[]> {
    const invoices = await stripe.invoices.list({
      customer: customerId,
      limit
    });

    return invoices.data;
  }
}

export const stripeService = new StripeService();
export default stripeService;
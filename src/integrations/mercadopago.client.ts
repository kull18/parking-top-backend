import {
  MercadoPagoConfig,
  Preference,
  Payment,
  PaymentRefund,
  PreApprovalPlan
} from 'mercadopago';

import { config } from '@/config/environment';
import logger from '@/utils/logger';

const mpClient = new MercadoPagoConfig({
  accessToken: config.mercadopago.accessToken
});

export class MercadoPagoService {
  private preferenceClient = new Preference(mpClient);
  private paymentClient = new Payment(mpClient);
  private refundClient = new PaymentRefund(mpClient);
  private planClient = new PreApprovalPlan(mpClient);

  async createPayment(data: {
    id: number;
    amount: number;
    description: string;
    payerEmail: string;
    metadata?: Record<string, any>;
  }) {
    try {
      const response = await this.preferenceClient.create({
        body: {
          items: [
            {
              id: `item-${data.id}`,
              title: data.description,
              unit_price: data.amount,
              quantity: 1,
              currency_id: 'MXN'
            }
          ],
          payer: { email: data.payerEmail },
          metadata: data.metadata ?? {},
          notification_url: `${config.app.apiUrl}/webhooks/mercadopago`,
          back_urls: {
            success: `${config.frontend.url}/payment/success`,
            failure: `${config.frontend.url}/payment/failure`,
            pending: `${config.frontend.url}/payment/pending`
          },
          auto_return: 'approved'
        }
      });

      return {
        id: response.id,
        init_point: response.init_point,
        sandbox_init_point: response.sandbox_init_point
      };
    } catch (error) {
      logger.error('Error creating MercadoPago payment:', error);
      throw error;
    }
  }

  async getPayment(paymentId: string) {
    try {
      return await this.paymentClient.get({ id: paymentId });
    } catch (error) {
      logger.error('Error getting MercadoPago payment:', error);
      throw error;
    }
  }

  async refundPayment(paymentId: string, amount?: number) {
    try {
      return await this.refundClient.create({
        payment_id: Number(paymentId),
        body: {
          ...(amount && { amount })
        }
      });
    } catch (error) {
      logger.error('Error refunding MercadoPago payment:', error);
      throw error;
    }
  }

  async createSubscription(data: {
    reason: string;
    autoRecurringAmount: number;
    frequency: number;
    frequencyType: 'days' | 'months';
    payerEmail: string;
  }) {
    try {
      const response = await this.planClient.create({
        body: {
          reason: data.reason,
          auto_recurring: {
            frequency: data.frequency,
            frequency_type: data.frequencyType,
            transaction_amount: data.autoRecurringAmount,
            currency_id: 'MXN'
          },
          back_url: `${config.frontend.url}/subscription/success`
        }
      });

      return {
        id: response.id,
        init_point: response.init_point
      };
    } catch (error) {
      logger.error('Error creating MercadoPago subscription:', error);
      throw error;
    }
  }
}

export default new MercadoPagoService();
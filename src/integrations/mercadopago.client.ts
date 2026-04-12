import {
  MercadoPagoConfig,
  Preference,
  Payment,
  PaymentRefund,
  PreApprovalPlan,
  PreApproval
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
  private preApprovalClient = new PreApproval(mpClient);

  /**
   * Crear preferencia de pago (Checkout)
   * NOTA: Esto NO crea un pago directo, crea un checkout
   * El payment_id real se genera cuando el usuario paga
   */
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
        external_reference: String(data.id),
        metadata: data.metadata ?? {},
        notification_url: `${config.app.apiUrl}/webhooks/mercadopago`,
        back_urls: {
  success: "parkingtop://payment/success",
  failure: "parkingtop://payment/failure",
  pending: "parkingtop://payment/pending"
},
auto_return: 'approved',
        statement_descriptor: 'PARKING TOP',
        expires: true,
        expiration_date_from: new Date().toISOString(),
        expiration_date_to: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
      }
    });

    logger.info(`MercadoPago preference created: ${response.id}`);

    // ✅ CAMBIO: Usar sandbox_init_point en modo TEST
    const isTest = config.mercadopago.accessToken.startsWith('TEST-');
    const paymentUrl = isTest ? response.sandbox_init_point : response.init_point;

    return {
      id: response.id,
      init_point: paymentUrl,  // ✅ Retornar la URL correcta
      sandbox_init_point: response.sandbox_init_point
    };
  } catch (error) {
    logger.error('Error creating MercadoPago payment:', error);
    throw error;
  }
}

  /**
   * Obtener información de un pago
   * Este ID es el payment_id que viene del webhook
   */
  async getPayment(paymentId: string) {
    try {
      const payment = await this.paymentClient.get({ id: paymentId });
      logger.info(`Retrieved payment ${paymentId}: status=${payment.status}`);
      return payment;
    } catch (error) {
      logger.error('Error getting MercadoPago payment:', error);
      throw error;
    }
  }

  /**
   * Buscar pagos por external_reference
   */
  async searchPaymentByReference(externalReference: string) {
    try {
      const response = await this.paymentClient.search({
        options: {
          criteria: 'desc',
          external_reference: externalReference
        }
      });

      if (response.results && response.results.length > 0) {
        return response.results[0];
      }

      return null;
    } catch (error) {
      logger.error(`Error searching payment by reference ${externalReference}:`, error);
      throw error;
    }
  }

  /**
   * Reembolsar un pago
   */
  async refundPayment(paymentId: string, amount?: number) {
    try {
      const refund = await this.refundClient.create({
        payment_id: Number(paymentId),
        body: {
          ...(amount && { amount })
        }
      });

      logger.info(`Refund created for payment ${paymentId}: ${refund.id}`);
      return refund;
    } catch (error) {
      logger.error('Error refunding MercadoPago payment:', error);
      throw error;
    }
  }

  /**
   * Crear plan de suscripción (PreApprovalPlan)
   * Esto crea un TEMPLATE de suscripción, NO una suscripción activa
   */
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

      logger.info(`MercadoPago subscription plan created: ${response.id}`);

      return {
        id: response.id,
        init_point: response.init_point
      };
    } catch (error) {
      logger.error('Error creating MercadoPago subscription:', error);
      throw error;
    }
  }

  /**
   * Crear suscripción activa (PreApproval)
   * Esto SÍ crea una suscripción real para un usuario
   */
  async createSubscriptionPreApproval(data: {
  reason: string;
  autoRecurringAmount: number;
  frequency: number;
  frequencyType: 'days' | 'months';
  payerEmail: string;
}) {
  try {
    const response = await this.preApprovalClient.create({
      body: {
        reason: data.reason,
        payer_email: data.payerEmail,
        // ✅ URL HTTPS válida — usa el mismo dominio del API
        back_url: `${config.app.apiUrl}/subscriptions/success`,
        auto_recurring: {
          frequency: data.frequency,
          frequency_type: data.frequencyType,
          transaction_amount: data.autoRecurringAmount,
          currency_id: 'MXN',
          start_date: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
        },
        status: 'pending'
      }
    });
 
    logger.info(`MercadoPago preapproval subscription created: ${response.id}`);
 
    return {
      id: response.id,
      init_point: response.init_point,
      status: response.status
    };
  } catch (error) {
    logger.error('Error creating MercadoPago preapproval:', error);
    throw error;
  }
}

  /**
   * Obtener suscripción
   */
  async getSubscription(preApprovalId: string) {
    try {
      const subscription = await this.preApprovalClient.get({ id: preApprovalId });
      logger.info(`Retrieved subscription ${preApprovalId}: status=${subscription.status}`);
      return subscription;
    } catch (error) {
      logger.error(`Error getting subscription ${preApprovalId}:`, error);
      throw error;
    }
  }

  /**
   * Cancelar suscripción
   */
  async cancelSubscription(preApprovalId: string) {
    try {
      const response = await this.preApprovalClient.update({
        id: preApprovalId,
        body: {
          status: 'cancelled'
        }
      });

      logger.info(`Subscription ${preApprovalId} cancelled`);
      return response;
    } catch (error) {
      logger.error(`Error cancelling subscription ${preApprovalId}:`, error);
      throw error;
    }
  }
}

export default new MercadoPagoService();
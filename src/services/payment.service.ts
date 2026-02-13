import paymentRepository from '@/repositories/payment.repository';
import { PaymentType, PaymentStatus } from '@/types/enums';
import { stripeService } from '@/integrations/stripe.client';
import logger from '@/utils/logger';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
export class PaymentService {
  
  async createPaymentIntent(
    userId: string,
    amount: number,
    paymentType: PaymentType,
    reservationId?: string,
    subscriptionId?: string
  ) {
    try {
      const paymentIntent = await stripeService.createPaymentIntent(amount, {
        userId,
        paymentType,
        ...(reservationId && { reservationId }),
        ...(subscriptionId && { subscriptionId })
      });

      const payment = await paymentRepository.create({
        userId,
        paymentType,
        reservationId,
        subscriptionId,
        amount,
        commissionAmount: 0, // Se calcula después
        netAmount: amount,
        paymentMethod: 'card',
        status: PaymentStatus.PENDING,
        paymentIntentId: paymentIntent.id
      });

      return { payment, paymentIntent };
    } catch (error) {
      logger.error('Error creating payment intent:', error);
      throw error;
    }
  }

  async confirmPayment(paymentIntentId: string) {
    try {
      const confirmedIntent = await stripeService.confirmPayment(paymentIntentId);

      // Buscar payment por paymentIntentId
      const payment = await prisma.payment.findFirst({
        where: { paymentIntentId }
      });

      if (payment) {
        await paymentRepository.update(payment.id, {
          status: PaymentStatus.COMPLETED,
          completedAt: new Date(),
          transactionId: confirmedIntent.id
        });
      }

      return confirmedIntent;
    } catch (error) {
      logger.error('Error confirming payment:', error);
      throw error;
    }
  }

  async getUserPayments(userId: string) {
    return await paymentRepository.findByUserId(userId);
  }

  async getPaymentById(id: string) {
    return await paymentRepository.findById(id);
  }

  async processRefund(paymentId: string, amount?: number) {
    try {
      const payment = await paymentRepository.findById(paymentId);

      if (!payment || payment.status !== PaymentStatus.COMPLETED) {
        throw new Error('Pago no válido para reembolso');
      }

      // Crear refund en Stripe (implementar en stripe.client.ts)
      // const refund = await stripeService.createRefund(payment.paymentIntentId!, amount);

      await paymentRepository.update(paymentId, {
        status: PaymentStatus.REFUNDED
      });

      // Crear registro de refund
      await paymentRepository.create({
        userId: payment.userId,
        paymentType: PaymentType.REFUND,
        ...(payment.reservationId && { reservationId: payment.reservationId }),
        amount: -(amount || payment.amount),
        commissionAmount: 0,
        netAmount: -(amount || payment.amount),
        paymentMethod: payment.paymentMethod,
        status: PaymentStatus.COMPLETED,
      });

      logger.info(`Refund processed for payment ${paymentId}`);
      return payment;
    } catch (error) {
      logger.error('Error processing refund:', error);
      throw error;
    }
  }
}

export default new PaymentService();
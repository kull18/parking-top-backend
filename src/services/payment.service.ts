import paymentRepository from '@/repositories/payment.repository';
import { PaymentType, PaymentStatus } from '@/types/enums';
import mercadopagoService from '@/integrations/mercadopago.client';
import logger from '@/utils/logger';
import prisma from '@/config/database';

export class PaymentService {
  
  /**
   * Crear pago con MercadoPago
   */
  async createPayment(
    userId: string,
    amount: number,
    paymentType: PaymentType,
    description: string,
    userEmail: string,
    reservationId?: string,
    subscriptionId?: string
  ) {
    try {
      // Crear pago en MercadoPago
      const mpPayment = await mercadopagoService.createPayment({
        id: Date.now(), // ID único basado en timestamp
        amount,
        description,
        payerEmail: userEmail,
        metadata: {
          userId,
          paymentType,
          ...(reservationId && { reservationId }),
          ...(subscriptionId && { subscriptionId })
        }
      });

      // Crear registro en DB
      const payment = await paymentRepository.create({
        userId,
        paymentType,
        reservationId,
        subscriptionId,
        amount,
        commissionAmount: 0, // Se calcula después
        netAmount: amount,
        paymentMethod: 'mercadopago',
        status: PaymentStatus.PENDING,
        transactionId: mpPayment.id
      });

      return { 
        payment, 
        paymentUrl: mpPayment.init_point, // URL para que el usuario complete el pago
        paymentId: mpPayment.id
      };
    } catch (error) {
      logger.error('Error creating payment:', error);
      throw error;
    }
  }

  /**
   * Confirmar pago (llamado desde webhook de MercadoPago)
   */
  async confirmPayment(transactionId: string) {
    try {
      // Obtener info del pago desde MercadoPago
      const mpPayment = await mercadopagoService.getPayment(transactionId);

      // Buscar payment por transactionId
      const payment = await prisma.payment.findFirst({
        where: { transactionId }
      });

      if (!payment) {
        logger.warn(`Payment not found for transaction ${transactionId}`);
        return null;
      }

      // Actualizar status según el estado de MP
      let status = PaymentStatus.PENDING;

      if (mpPayment.status === 'approved') {
        status = PaymentStatus.COMPLETED;
      } else if (mpPayment.status === 'rejected' || mpPayment.status === 'cancelled') {
        status = PaymentStatus.FAILED;
      }

      const updatedPayment = await paymentRepository.update(payment.id, {
        status,
        completedAt: status === PaymentStatus.COMPLETED ? new Date() : undefined
      });

      logger.info(`Payment ${payment.id} updated to status: ${status}`);

      return updatedPayment;
    } catch (error) {
      logger.error('Error confirming payment:', error);
      throw error;
    }
  }

  /**
   * Obtener pagos del usuario
   */
  async getUserPayments(userId: string) {
    return await paymentRepository.findByUserId(userId);
  }

  /**
   * Obtener pago por ID
   */
  async getPaymentById(id: string) {
    return await paymentRepository.findById(id);
  }

  /**
   * Obtener estado del pago desde MercadoPago
   */
  async getPaymentStatus(transactionId: string) {
    try {
      const mpPayment = await mercadopagoService.getPayment(transactionId);

      return {
        id: mpPayment.id,
        status: mpPayment.status,
        statusDetail: mpPayment.status_detail,
        amount: mpPayment.transaction_amount,
        paymentMethod: mpPayment.payment_method_id,
        dateApproved: mpPayment.date_approved
      };
    } catch (error) {
      logger.error('Error getting payment status:', error);
      throw error;
    }
  }

  /**
   * Procesar reembolso
   */
  async processRefund(paymentId: string, amount?: number) {
    try {
      const payment = await paymentRepository.findById(paymentId);

      if (!payment || payment.status !== PaymentStatus.COMPLETED) {
        throw new Error('Pago no válido para reembolso');
      }

      if (!payment.transactionId) {
        throw new Error('No se encontró el ID de transacción de MercadoPago');
      }

      // Crear refund en MercadoPago
      const refund = await mercadopagoService.refundPayment(
        payment.transactionId,
        amount ? Number(amount) : undefined
      );

      // Actualizar payment como refunded
      await paymentRepository.update(paymentId, {
        status: PaymentStatus.REFUNDED
      });

      // Crear registro de refund
      await paymentRepository.create({
        userId: payment.userId,
        paymentType: PaymentType.REFUND,
        ...(payment.reservationId && { reservationId: payment.reservationId }),
        amount: -(amount || Number(payment.amount)),
        commissionAmount: 0,
        netAmount: -(amount || Number(payment.amount)),
        paymentMethod: payment.paymentMethod,
        status: PaymentStatus.COMPLETED,
        transactionId: refund.id?.toString(),
      });

      logger.info(`Refund processed for payment ${paymentId}`);
      return payment;
    } catch (error) {
      logger.error('Error processing refund:', error);
      throw error;
    }
  }

  /**
   * Marcar pago como fallido
   */
  async markPaymentAsFailed(transactionId: string, reason?: string) {
    try {
      const payment = await prisma.payment.findFirst({
        where: { transactionId }
      });

      if (!payment) {
        logger.warn(`Payment not found for transaction ${transactionId}`);
        return null;
      }

      await paymentRepository.update(payment.id, {
        status: PaymentStatus.FAILED,
        metadata: { failureReason: reason }
      });

      logger.info(`Payment ${payment.id} marked as failed: ${reason}`);

      return payment;
    } catch (error) {
      logger.error('Error marking payment as failed:', error);
      throw error;
    }
  }

  /**
   * Obtener pagos por reserva
   */
  async getPaymentsByReservation(reservationId: string) {
    return await prisma.payment.findMany({
      where: { reservationId },
      orderBy: { createdAt: 'desc' }
    });
  }

  /**
   * Obtener pagos por suscripción
   */
  async getPaymentsBySubscription(subscriptionId: string) {
    return await prisma.payment.findMany({
      where: { subscriptionId },
      orderBy: { createdAt: 'desc' }
    });
  }

  /**
   * Calcular estadísticas de pagos
   */
  async getPaymentStats(userId: string) {
    const [total, completed, pending, failed] = await Promise.all([
      prisma.payment.aggregate({
        where: { userId },
        _sum: { amount: true },
        _count: true
      }),
      prisma.payment.aggregate({
        where: { userId, status: PaymentStatus.COMPLETED },
        _sum: { amount: true },
        _count: true
      }),
      prisma.payment.count({
        where: { userId, status: PaymentStatus.PENDING }
      }),
      prisma.payment.count({
        where: { userId, status: PaymentStatus.FAILED }
      })
    ]);

    return {
      totalPayments: total._count,
      totalAmount: Number(total._sum.amount) || 0,
      completedPayments: completed._count,
      completedAmount: Number(completed._sum.amount) || 0,
      pendingPayments: pending,
      failedPayments: failed
    };
  }
}

export default new PaymentService();
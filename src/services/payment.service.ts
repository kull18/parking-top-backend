import paymentRepository from '@/repositories/payment.repository';
import { PaymentType, PaymentStatus } from '@/types/enums';
import mercadopagoService from '@/integrations/mercadopago.client';
import logger from '@/utils/logger';
import prisma from '@/config/database';

export class PaymentService {

  /**
   * Crear pago con MercadoPago
   * IMPORTANTE: Esto crea una preference (checkout), NO un pago directo
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
      // Crear preference en MercadoPago
      const mpPreference = await mercadopagoService.createPayment({
        id: Date.now(),
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

      // ⚠️ CAMBIO CRÍTICO: Guardar preference_id en metadata
      // El payment_id real vendrá del webhook
      const payment = await paymentRepository.create({
        userId,
        paymentType,
        reservationId,
        subscriptionId,
        amount,
        commissionAmount: 0,
        netAmount: amount,
        paymentMethod: 'mercadopago',
        status: PaymentStatus.PENDING,
        // NO guardamos transactionId aún porque no existe
        // transactionId: null,
        metadata: {
          preferenceId: mpPreference.id, // Guardamos el preference_id aquí
          externalReference: String(Date.now())
        }
      });

      return {
        payment,
        paymentUrl: mpPreference.init_point,
        preferenceId: mpPreference.id
      };
    } catch (error) {
      logger.error('Error creating payment:', error);
      throw error;
    }
  }

  /**
   * Confirmar pago (llamado desde webhook de MercadoPago)
   * IMPORTANTE: Aquí sí recibimos el payment_id real
   */
  async confirmPayment(paymentId: string) {
    try {
      // Obtener info del pago desde MercadoPago
      const mpPayment = await mercadopagoService.getPayment(paymentId);

      logger.info(`Processing MP payment ${paymentId}: status=${mpPayment.status}`);

      // Buscar payment en DB por external_reference o metadata
      let payment = await prisma.payment.findFirst({
        where: {
          OR: [
            { transactionId: paymentId },
            {
              metadata: {
                path: ['externalReference'],
                equals: mpPayment.external_reference
              }
            }
          ]
        }
      });

      // Si no encontramos el payment, buscar por preferenceId en metadata
      if (!payment && mpPayment.metadata) {
        const metadata = mpPayment.metadata as any;
        if (metadata.reservationId) {
          payment = await prisma.payment.findFirst({
            where: {
              reservationId: metadata.reservationId,
              status: PaymentStatus.PENDING
            },
            orderBy: { createdAt: 'desc' }
          });
        }
      }

      if (!payment) {
        logger.warn(`Payment not found for MP payment ${paymentId}`);
        return null;
      }

      // Mapear status de MercadoPago a nuestro enum
      let status = PaymentStatus.PENDING;

      if (mpPayment.status === 'approved') {
        status = PaymentStatus.COMPLETED;
      } else if (mpPayment.status === 'rejected' || mpPayment.status === 'cancelled') {
        status = PaymentStatus.FAILED;
      } else if (mpPayment.status === 'pending' || mpPayment.status === 'in_process') {
        status = PaymentStatus.PENDING;
      }

      // Actualizar payment con el payment_id real
      const updatedPayment = await paymentRepository.update(payment.id, {
        status,
        transactionId: paymentId, // ✅ AHORA SÍ guardamos el payment_id real
        completedAt: status === PaymentStatus.COMPLETED ? new Date() : undefined,
        metadata: {
          ...(payment.metadata as any || {}),
          mpPaymentId: paymentId,
          mpStatus: mpPayment.status,
          mpStatusDetail: mpPayment.status_detail
        }
      });

      logger.info(`Payment ${payment.id} updated to status: ${status}`);

      // Si el pago fue aprobado, ejecutar acciones
      if (status === PaymentStatus.COMPLETED) {

        // Pago de reserva → confirmar reserva
        if (payment.paymentType === PaymentType.RESERVATION && payment.reservationId) {
          const { default: reservationService } = await import('@/services/reservation.service');
          await reservationService.confirmReservation(payment.reservationId);
          logger.info(`Reservation ${payment.reservationId} confirmed`);
        }

        // Pago de overtime → marcar OvertimeCharge como pagado
        if (payment.paymentType === PaymentType.OVERTIME && payment.reservationId) {
          await prisma.overtimeCharge.update({
            where: { reservationId: payment.reservationId },
            data: { isPaid: true, paidAt: new Date() }
          });
          logger.info(`OvertimeCharge marked as paid for reservation: ${payment.reservationId}`);
        }

        // Pago de suscripción → activar suscripción
        if (payment.paymentType === PaymentType.SUBSCRIPTION && payment.subscriptionId) {
          const { default: subscriptionService } = await import('@/services/subscription.service.mercadopago');
          await subscriptionService.confirmSubscriptionPayment(payment.subscriptionId);
          logger.info(`Subscription ${payment.subscriptionId} activated`);
        }
      }

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

      const refund = await mercadopagoService.refundPayment(
        payment.transactionId,
        amount ? Number(amount) : undefined
      );

      await paymentRepository.update(paymentId, {
        status: PaymentStatus.REFUNDED
      });

      await paymentRepository.create({
        userId: payment.userId,
        paymentType: PaymentType.REFUND,
        ...(payment.reservationId && { reservationId: payment.reservationId }),
        amount: -(amount || Number(payment.amount)),
        commissionAmount: 0,
        netAmount: -(amount || Number(payment.amount)),
        paymentMethod: payment.paymentMethod,
        status: PaymentStatus.COMPLETED,
        transactionId: refund.id?.toString()
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
        metadata: { 
          ...(payment.metadata as any),
          failureReason: reason 
        }
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
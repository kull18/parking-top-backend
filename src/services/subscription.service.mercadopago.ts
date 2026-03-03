import subscriptionRepository from '@/repositories/subscription.repository';
import userRepository from '@/repositories/user.repository';
import mercadopagoService from '@/integrations/mercadopago.client';
import notificationService from '@/services/notification.service';
import { SubscriptionStatus } from '@/types/enums';
import logger from '@/utils/logger';
import prisma from '@/config/database';

export class SubscriptionService {

  /**
   * Obtener planes disponibles
   */
  async getPlans() {
    return await prisma.subscriptionPlan.findMany({
      where: { isActive: true },
      orderBy: { monthlyPrice: 'asc' }
    });
  }

  /**
   * Obtener plan por ID
   */
  async getPlanById(planId: string) {
    const plan = await prisma.subscriptionPlan.findUnique({
      where: { id: planId }
    });

    if (!plan) {
      throw new Error('PLAN_NOT_FOUND');
    }

    return plan;
  }

  /**
   * Obtener suscripción del usuario
   */
  async getUserSubscription(userId: string) {
    const subscription = await subscriptionRepository.findByUserId(userId);

    if (!subscription) {
      throw new Error('SUBSCRIPTION_NOT_FOUND');
    }

    return subscription;
  }

  /**
   * Crear nueva suscripción con MercadoPago
   */
  async createSubscription(userId: string, data: {
    planId: string;
  }) {
    try {
      // Verificar que no tenga suscripción activa
      const existingSubscription = await subscriptionRepository.findActiveByUserId(userId);

      if (existingSubscription) {
        throw new Error('ALREADY_SUBSCRIBED');
      }

      // Obtener plan
      const plan = await this.getPlanById(data.planId);

      // Obtener usuario
      const user = await userRepository.findById(userId);

      if (!user) {
        throw new Error('USER_NOT_FOUND');
      }

      // Crear suscripción en MercadoPago
      const mpSubscription = await mercadopagoService.createSubscription({
        reason: `${plan.displayName} - Parking Top`,
        autoRecurringAmount: Number(plan.monthlyPrice),
        frequency: 1,
        frequencyType: 'months',
        payerEmail: user.email
      });

      // Calcular fechas
      const now = new Date();
      const trialEndDate = plan.trialDays > 0
        ? new Date(now.getTime() + plan.trialDays * 24 * 60 * 60 * 1000)
        : undefined;

      const currentPeriodEnd = new Date();
      currentPeriodEnd.setMonth(currentPeriodEnd.getMonth() + 1);

      // Crear suscripción en DB
      const subscription = await subscriptionRepository.create({
        userId,
        planId: plan.id,
        status: plan.trialDays > 0 ? SubscriptionStatus.TRIAL : SubscriptionStatus.ACTIVE,
        startDate: now,
        trialStartDate: plan.trialDays > 0 ? now : undefined,
        trialEndDate,
        currentPeriodStart: now,
        currentPeriodEnd,
        stripeSubscriptionId: mpSubscription.id // Guardamos el ID de MP aquí
      });

      logger.info(`Subscription created for user ${userId}: ${subscription.id}`);

      // Enviar notificación
      await notificationService.create({
        userId,
        type: 'subscription_created' as any,
        title: '¡Suscripción activada!',
        message: `Tu plan ${plan.displayName} está activo. ${plan.trialDays > 0 ? `Tienes ${plan.trialDays} días de prueba gratis.` : 'Completa el pago en MercadoPago para activar tu cuenta.'}`,
        subscriptionId: subscription.id
      });

      return {
        subscription,
        paymentUrl: mpSubscription.init_point // URL para completar el pago
      };
    } catch (error: any) {
      logger.error('Error creating subscription:', error);
      throw error;
    }
  }

  /**
   * Actualizar plan (upgrade/downgrade)
   */
  async updateSubscriptionPlan(userId: string, newPlanId: string) {
    try {
      const subscription = await subscriptionRepository.findByUserId(userId);

      if (!subscription) {
        throw new Error('SUBSCRIPTION_NOT_FOUND');
      }

      if (subscription.status !== SubscriptionStatus.ACTIVE && subscription.status !== SubscriptionStatus.TRIAL) {
        throw new Error('SUBSCRIPTION_NOT_ACTIVE');
      }

      const newPlan = await this.getPlanById(newPlanId);

      // Con MercadoPago hay que cancelar la vieja y crear nueva
      // Esto es una limitación de MP
      const updatedSubscription = await subscriptionRepository.update(subscription.id, {
        planId: newPlan.id
      });

      logger.info(`Subscription plan updated for user ${userId}: ${newPlan.name}`);

      // Notificar al usuario
      await notificationService.create({
        userId,
        type: 'subscription_updated' as any,
        title: 'Plan actualizado',
        message: `Tu plan ha sido actualizado a ${newPlan.displayName}. Se cobrará $${newPlan.monthlyPrice} MXN en tu próximo período.`,
        subscriptionId: subscription.id
      });

      return updatedSubscription;
    } catch (error) {
      logger.error('Error updating subscription plan:', error);
      throw error;
    }
  }

  /**
   * Cancelar suscripción
   */
  async cancelSubscription(userId: string, data: {
    cancelAtPeriodEnd?: boolean;
    cancellationReason?: string;
  }) {
    try {
      const subscription = await subscriptionRepository.findByUserId(userId);

      if (!subscription) {
        throw new Error('SUBSCRIPTION_NOT_FOUND');
      }

      if (subscription.status === SubscriptionStatus.CANCELLED || subscription.status === SubscriptionStatus.EXPIRED) {
        throw new Error('SUBSCRIPTION_ALREADY_CANCELLED');
      }

      const cancelAtPeriodEnd = data.cancelAtPeriodEnd ?? true;

      // Actualizar en DB
      const updateData: any = {
        cancelAtPeriodEnd,
        cancellationReason: data.cancellationReason
      };

      if (!cancelAtPeriodEnd) {
        updateData.status = SubscriptionStatus.CANCELLED;
        updateData.endedAt = new Date();

        // Desactivar estacionamientos inmediatamente
        await prisma.parkingLot.updateMany({
          where: { ownerId: userId },
          data: { status: 'suspended_payment' }
        });
      }

      updateData.cancelledAt = new Date();

      const updatedSubscription = await subscriptionRepository.update(
        subscription.id,
        updateData
      );

      logger.info(`Subscription cancelled for user ${userId}`);

      // Notificar al usuario
      const message = cancelAtPeriodEnd
        ? `Tu suscripción se cancelará el ${subscription.currentPeriodEnd?.toLocaleDateString('es-MX')}`
        : 'Tu suscripción ha sido cancelada inmediatamente';

      await notificationService.create({
        userId,
        type: 'subscription_cancelled' as any,
        title: 'Suscripción cancelada',
        message,
        subscriptionId: subscription.id
      });

      return updatedSubscription;
    } catch (error) {
      logger.error('Error cancelling subscription:', error);
      throw error;
    }
  }

  /**
   * Reactivar suscripción cancelada
   */
  async reactivateSubscription(userId: string) {
    try {
      const subscription = await subscriptionRepository.findByUserId(userId);

      if (!subscription) {
        throw new Error('SUBSCRIPTION_NOT_FOUND');
      }

      if (!subscription.cancelAtPeriodEnd) {
        throw new Error('SUBSCRIPTION_NOT_SCHEDULED_FOR_CANCELLATION');
      }

      // Actualizar en DB
      const updatedSubscription = await subscriptionRepository.update(subscription.id, {
  cancelAtPeriodEnd: false,
  cancelledAt: undefined,
  cancellationReason: undefined
});

      logger.info(`Subscription reactivated for user ${userId}`);

      // Notificar al usuario
      await notificationService.create({
        userId,
        type: 'subscription_reactivated' as any,
        title: 'Suscripción reactivada',
        message: 'Tu suscripción ha sido reactivada exitosamente',
        subscriptionId: subscription.id
      });

      return updatedSubscription;
    } catch (error) {
      logger.error('Error reactivating subscription:', error);
      throw error;
    }
  }

  /**
   * Confirmar pago de suscripción (llamado desde webhook de MercadoPago)
   */
  async confirmSubscriptionPayment(subscriptionId: string) {
    try {
      const subscription = await subscriptionRepository.findById(subscriptionId);

      if (!subscription) {
        throw new Error('SUBSCRIPTION_NOT_FOUND');
      }

      // Actualizar período
      const now = new Date();
      const nextPeriodEnd = new Date();
      nextPeriodEnd.setMonth(nextPeriodEnd.getMonth() + 1);

      await subscriptionRepository.update(subscriptionId, {
        status: SubscriptionStatus.ACTIVE,
        currentPeriodStart: now,
        currentPeriodEnd: nextPeriodEnd
      });

      // Reactivar estacionamientos
      await prisma.parkingLot.updateMany({
        where: { ownerId: subscription.userId },
        data: { status: 'active' }
      });

      // Notificar
      await notificationService.create({
        userId: subscription.userId,
        type: 'payment_received' as any,
        title: 'Pago recibido',
        message: `Hemos recibido tu pago de $${subscription.plan.monthlyPrice} MXN`,
        subscriptionId: subscription.id
      });

      logger.info(`Subscription payment confirmed: ${subscriptionId}`);
    } catch (error) {
      logger.error('Error confirming subscription payment:', error);
      throw error;
    }
  }

  /**
   * Marcar pago como fallido
   */
  async markSubscriptionPaymentFailed(subscriptionId: string) {
    try {
      const subscription = await subscriptionRepository.findById(subscriptionId);

      if (!subscription) {
        throw new Error('SUBSCRIPTION_NOT_FOUND');
      }

      await subscriptionRepository.update(subscriptionId, {
        status: SubscriptionStatus.PAST_DUE
      });

      // Suspender estacionamientos
      await prisma.parkingLot.updateMany({
        where: { ownerId: subscription.userId },
        data: { status: 'suspended_payment' }
      });

      // Notificar
      await notificationService.sendPaymentFailed(
        subscription.userId,
        subscription.id
      );

      logger.info(`Subscription payment failed: ${subscriptionId}`);
    } catch (error) {
      logger.error('Error marking payment as failed:', error);
      throw error;
    }
  }

  /**
   * Verificar suscripciones expiradas (cron job)
   */
  async checkExpiredSubscriptions() {
    try {
      const expiredSubscriptions = await subscriptionRepository.findExpiredSubscriptions();

      for (const subscription of expiredSubscriptions) {
        await subscriptionRepository.update(subscription.id, {
          status: SubscriptionStatus.EXPIRED,
          endedAt: new Date()
        });

        // Desactivar estacionamientos
        await prisma.parkingLot.updateMany({
          where: { ownerId: subscription.userId },
          data: { status: 'suspended_payment' }
        });

        // Notificar
        await notificationService.sendSubscriptionExpired(
          subscription.userId,
          subscription.id
        );

        logger.info(`Subscription expired: ${subscription.id}`);
      }

      return {
        checked: expiredSubscriptions.length,
        expired: expiredSubscriptions.length
      };
    } catch (error) {
      logger.error('Error checking expired subscriptions:', error);
      throw error;
    }
  }

  /**
   * Enviar recordatorios de renovación (cron job)
   */
  async sendRenewalReminders(daysBeforeExpiry: number = 3) {
    try {
      const expiringSubscriptions = await subscriptionRepository.findExpiringSubscriptions(daysBeforeExpiry);

      for (const subscription of expiringSubscriptions) {
        const daysLeft = Math.ceil(
          (subscription.currentPeriodEnd!.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
        );

        await notificationService.sendSubscriptionExpiring(
          subscription.userId,
          subscription.id,
          daysLeft
        );
      }

      logger.info(`Sent ${expiringSubscriptions.length} renewal reminders`);

      return {
        sent: expiringSubscriptions.length
      };
    } catch (error) {
      logger.error('Error sending renewal reminders:', error);
      throw error;
    }
  }
}

export default new SubscriptionService();
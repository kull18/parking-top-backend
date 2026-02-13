import prisma from '@/config/database';
import { SubscriptionStatus, ParkingStatus, NotificationType } from '@/types/enums';
import { ISubscription, CreateSubscriptionDTO } from '@/types/interfaces';
import { stripeService } from '@/integrations/stripe.client';
import firebaseService from '@/integrations/firebase.client';
import logger from '@/utils/logger';
import dayjs from 'dayjs';

export class SubscriptionService {
  
  async createSubscription(userId: string, dto: CreateSubscriptionDTO): Promise<ISubscription> {
    try {
      // Obtener plan
      const plan = await prisma.subscriptionPlan.findUnique({ 
        where: { id: dto.planId } 
      });

      if (!plan || !plan.isActive) {
        throw new Error('Plan no disponible');
      }

      // Verificar si ya tiene suscripción activa
      const existingSubscription = await this.getActiveSubscription(userId);
      if (existingSubscription) {
        throw new Error('Ya tienes una suscripción activa');
      }

      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (!user) throw new Error('Usuario no encontrado');

      // Crear o obtener Stripe Customer
      let stripeCustomerId = await this.getOrCreateStripeCustomer(user);

      // Attach payment method
      await stripeService.attachPaymentMethod(dto.paymentMethodId, stripeCustomerId);

      // Crear suscripción en Stripe
      const stripeSub = await stripeService.createSubscription(
        stripeCustomerId,
        plan.stripePriceId!,
        plan.trialDays,
        dto.paymentMethodId
      );

      // Crear en DB
      const trialStart = new Date();
      const trialEnd = dayjs(trialStart).add(plan.trialDays, 'day').toDate();

      const subscription = await prisma.subscription.create({
        data: {
          userId,
          planId: plan.id,
          status: SubscriptionStatus.TRIAL,
          trialStartDate: trialStart,
          trialEndDate: trialEnd,
          startDate: trialStart,
          currentPeriodStart: trialStart,
          currentPeriodEnd: trialEnd,
          stripeSubscriptionId: stripeSub.id,
          stripeCustomerId: stripeCustomerId,
          cancelAtPeriodEnd: false
        }
      });

      // Notificar
      await this.createNotification(
        userId,
        NotificationType.GENERAL,
        '¡Bienvenido a Parking Top!',
        `Tu plan ${plan.displayName} está activo con ${plan.trialDays} días de prueba.`
      );

      logger.info(`Subscription created for user ${userId}`);
      return subscription as ISubscription;

    } catch (error: any) {
      logger.error('Error creating subscription:', error);
      throw error;
    }
  }

  async getActiveSubscription(userId: string): Promise<ISubscription | null> {
    return await prisma.subscription.findFirst({
      where: {
        userId,
        status: { in: [SubscriptionStatus.ACTIVE, SubscriptionStatus.TRIAL] }
      },
      include: { plan: true },
      orderBy: { createdAt: 'desc' }
    }) as ISubscription | null;
  }

  async checkAndUpdateSubscriptions(): Promise<void> {
    try {
      const now = new Date();

      // Trials expirados
      const expiredTrials = await prisma.subscription.findMany({
        where: {
          status: SubscriptionStatus.TRIAL,
          trialEndDate: { lte: now }
        }
      });

      for (const sub of expiredTrials) {
        try {
          const stripeSub = await stripeService.updateSubscription(sub.stripeSubscriptionId!, {});
          
          if (stripeSub.status === 'active') {
            await this.activateSubscription(sub.id);
          } else {
            await this.markSubscriptionPastDue(sub.id);
          }
        } catch (error) {
          logger.error(`Error processing trial ${sub.id}:`, error);
        }
      }

      // Suspender suscripciones past_due > 3 días
      const gracePeriodEnd = dayjs(now).subtract(3, 'day').toDate();
      const toExpire = await prisma.subscription.findMany({
        where: {
          status: SubscriptionStatus.PAST_DUE,
          currentPeriodEnd: { lte: gracePeriodEnd }
        }
      });

      for (const sub of toExpire) {
        await this.expireSubscription(sub.id);
      }

      logger.info(`Checked ${expiredTrials.length + toExpire.length} subscriptions`);

    } catch (error) {
      logger.error('Error checking subscriptions:', error);
    }
  }

  async sendRenewalReminders(): Promise<void> {
    const reminderDate = dayjs().add(7, 'day').toDate();

    const subscriptions = await prisma.subscription.findMany({
      where: {
        status: SubscriptionStatus.ACTIVE,
        currentPeriodEnd: {
          gte: dayjs().toDate(),
          lte: reminderDate
        }
      },
      include: { plan: true }
    });

    for (const sub of subscriptions) {
      await this.createNotification(
        sub.userId,
        NotificationType.SUBSCRIPTION_EXPIRING,
        'Tu suscripción se renueva pronto',
        `Tu plan ${sub.plan.displayName} se renovará el ${dayjs(sub.currentPeriodEnd).format('DD/MM/YYYY')}`
      );

      await firebaseService.sendToUser(sub.userId, {
        title: 'Renovación próxima',
        body: `Tu suscripción se renueva en 7 días`
      });
    }

    logger.info(`Sent ${subscriptions.length} renewal reminders`);
  }

  async changePlan(subscriptionId: string, newPlanId: string): Promise<ISubscription> {
    const subscription = await prisma.subscription.findUnique({
      where: { id: subscriptionId },
      include: { plan: true }
    });

    if (!subscription) throw new Error('Suscripción no encontrada');

    const newPlan = await prisma.subscriptionPlan.findUnique({
      where: { id: newPlanId }
    });

    if (!newPlan) throw new Error('Plan no encontrado');

    const stripeSub = await stripeService.updateSubscription(
      subscription.stripeSubscriptionId!,
      {
        items: [{
          price: newPlan.stripePriceId!
        }],
        proration_behavior: 'always_invoice'
      }
    );

    return await prisma.subscription.update({
      where: { id: subscriptionId },
      data: { planId: newPlan.id }
    }) as ISubscription;
  }

  async cancelSubscription(
    subscriptionId: string,
    cancelAtPeriodEnd: boolean = true,
    reason?: string
  ): Promise<void> {
    const subscription = await prisma.subscription.findUnique({
      where: { id: subscriptionId }
    });

    if (!subscription) throw new Error('Suscripción no encontrada');

    await stripeService.cancelSubscription(
      subscription.stripeSubscriptionId!,
      cancelAtPeriodEnd
    );

    if (cancelAtPeriodEnd) {
      await prisma.subscription.update({
        where: { id: subscriptionId },
        data: {
          cancelAtPeriodEnd: true,
          cancellationReason: reason
        }
      });
    } else {
      await prisma.subscription.update({
        where: { id: subscriptionId },
        data: {
          status: SubscriptionStatus.CANCELLED,
          cancelledAt: new Date(),
          endedAt: new Date(),
          cancellationReason: reason
        }
      });

      await prisma.parkingLot.updateMany({
        where: { subscriptionId },
        data: { status: ParkingStatus.SUSPENDED_PAYMENT }
      });
    }

    logger.info(`Subscription ${subscriptionId} cancelled`);
  }

  async reactivateSubscription(subscriptionId: string, paymentMethodId: string): Promise<void> {
    const subscription = await prisma.subscription.findUnique({
      where: { id: subscriptionId }
    });

    if (!subscription) throw new Error('Suscripción no encontrada');

    // Attach nuevo método de pago
    await stripeService.attachPaymentMethod(paymentMethodId, subscription.stripeCustomerId!);

    // Reactivar
    await prisma.subscription.update({
      where: { id: subscriptionId },
      data: { status: SubscriptionStatus.ACTIVE }
    });

    await prisma.parkingLot.updateMany({
      where: { subscriptionId },
      data: { status: ParkingStatus.ACTIVE }
    });

    logger.info(`Subscription ${subscriptionId} reactivated`);
  }

  private async activateSubscription(subscriptionId: string): Promise<void> {
    await prisma.subscription.update({
      where: { id: subscriptionId },
      data: { status: SubscriptionStatus.ACTIVE }
    });
  }

  private async markSubscriptionPastDue(subscriptionId: string): Promise<void> {
    const subscription = await prisma.subscription.update({
      where: { id: subscriptionId },
      data: { status: SubscriptionStatus.PAST_DUE }
    });

    await this.createNotification(
      subscription.userId,
      NotificationType.PAYMENT_FAILED,
      'Problema con tu pago',
      'No pudimos procesar tu pago. Actualiza tu método de pago.'
    );
  }

  private async expireSubscription(subscriptionId: string): Promise<void> {
    const subscription = await prisma.subscription.update({
      where: { id: subscriptionId },
      data: {
        status: SubscriptionStatus.EXPIRED,
        endedAt: new Date()
      }
    });

    await prisma.parkingLot.updateMany({
      where: { subscriptionId },
      data: { status: ParkingStatus.SUSPENDED_PAYMENT }
    });

    await this.createNotification(
      subscription.userId,
      NotificationType.SUBSCRIPTION_EXPIRED,
      'Suscripción expirada',
      'Tus estacionamientos han sido suspendidos por falta de pago.'
    );
  }

  private async getOrCreateStripeCustomer(user: any): Promise<string> {
    const existing = await prisma.subscription.findFirst({
      where: { userId: user.id },
      select: { stripeCustomerId: true }
    });

    if (existing?.stripeCustomerId) return existing.stripeCustomerId;

    const customer = await stripeService.createCustomer(
      user.email,
      user.fullName,
      { userId: user.id }
    );

    return customer.id;
  }

  private async createNotification(
    userId: string,
    type: NotificationType,
    title: string,
    message: string
  ): Promise<void> {
    await prisma.notification.create({
      data: {
        userId,
        type,
        title,
        message,
        isRead: false,
        isSent: false
      }
    });
  }
}

export default new SubscriptionService();
import prisma from '@/config/database';
import { SubscriptionStatus } from '@/types/enums';

export class SubscriptionRepository {

  async findById(subscriptionId: string) {
    return await prisma.subscription.findUnique({
      where: { id: subscriptionId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            fullName: true
          }
        },
        plan: true
      }
    });
  }

  async findByUserId(userId: string) {
    return await prisma.subscription.findUnique({
      where: { userId },
      include: { plan: true }
    });
  }

  async findByMpSubscriptionId(mpSubscriptionId: string) {
    return await prisma.subscription.findFirst({
      where: { mpSubscriptionId },
      include: {
        user: true,
        plan: true
      }
    });
  }

  async findActiveByUserId(userId: string) {
    return await prisma.subscription.findFirst({
      where: {
        userId,
        status: { in: [SubscriptionStatus.ACTIVE, SubscriptionStatus.TRIAL] }
      },
      include: { plan: true }
    });
  }

  async create(data: {
    userId: string;
    planId: string;
    status: SubscriptionStatus;
    startDate: Date;
    trialStartDate?: Date;
    trialEndDate?: Date;
    currentPeriodStart?: Date;
    currentPeriodEnd?: Date;
    mpSubscriptionId?: string;
    mpPreapprovalId?: string;
  }) {
    return await prisma.subscription.create({
      data,
      include: {
        plan: true,
        user: {
          select: {
            id: true,
            email: true,
            fullName: true
          }
        }
      }
    });
  }

  async update(subscriptionId: string, data: Partial<{
    planId: string;
    status: SubscriptionStatus;
    currentPeriodStart: Date;
    currentPeriodEnd: Date;
    cancelledAt: Date | undefined;
    cancelAtPeriodEnd: boolean;
    cancellationReason: string | undefined;
    endedAt: Date;
    mpSubscriptionId: string;
    mpPreapprovalId: string;
  }>) {
    return await prisma.subscription.update({
      where: { id: subscriptionId },
      data,
      include: { plan: true }
    });
  }

  async delete(subscriptionId: string) {
    return await prisma.subscription.delete({
      where: { id: subscriptionId }
    });
  }

  async findExpiringSubscriptions(daysBeforeExpiry: number) {
    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + daysBeforeExpiry);

    return await prisma.subscription.findMany({
      where: {
        status: SubscriptionStatus.ACTIVE,
        currentPeriodEnd: {
          lte: targetDate,
          gte: new Date()
        }
      },
      include: {
        user: true,
        plan: true
      }
    });
  }

  async findExpiredSubscriptions() {
    return await prisma.subscription.findMany({
      where: {
        status: { in: [SubscriptionStatus.ACTIVE, SubscriptionStatus.PAST_DUE] },
        currentPeriodEnd: { lt: new Date() }
      },
      include: {
        user: true,
        plan: true
      }
    });
  }

  async countActiveSubscriptions() {
    return await prisma.subscription.count({
      where: {
        status: { in: [SubscriptionStatus.ACTIVE, SubscriptionStatus.TRIAL] }
      }
    });
  }
}

export default new SubscriptionRepository();
import prisma from '@/config/database';
import { PaymentStatus, PaymentType } from '@/types/enums';

export class PaymentRepository {
  
  async findById(id: string) {
    return await prisma.payment.findUnique({
      where: { id },
      include: {
        user: true,
        reservation: true,
        subscription: true
      }
    });
  }

  async findByUserId(userId: string) {
    return await prisma.payment.findMany({
      where: { userId },
      include: {
        reservation: {
          include: {
            parkingLot: {
              select: {
                name: true
              }
            }
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
  }

  async findByReservationId(reservationId: string) {
    return await prisma.payment.findMany({
      where: { reservationId },
      orderBy: { createdAt: 'desc' }
    });
  }

  async create(data: {
    userId: string;
    paymentType: PaymentType;
    reservationId?: string;
    subscriptionId?: string;
    amount: number;
    commissionAmount: number;
    netAmount: number;
    paymentMethod: string;
    status: PaymentStatus;
    paymentIntentId?: string;
    transactionId?: string;
    metadata?: any;
    completedAt?: Date; // ✅ AGREGADO
  }) {
    return await prisma.payment.create({
      data
    });
  }

  async update(id: string, data: any) {
    return await prisma.payment.update({
      where: { id },
      data
    });
  }

  async findPendingPayments() {
    return await prisma.payment.findMany({
      where: {
        status: PaymentStatus.PENDING
      },
      include: {
        user: true,
        reservation: true
      }
    });
  }

  async getTotalRevenueByOwnerId(ownerId: string, startDate: Date, endDate: Date) {
    const payments = await prisma.payment.findMany({
      where: {
        status: PaymentStatus.COMPLETED,
        paymentType: PaymentType.RESERVATION,
        createdAt: {
          gte: startDate,
          lte: endDate
        },
        reservation: {
          parkingLot: {
            ownerId
          }
        }
      },
      select: {
        netAmount: true
      }
    });

    return payments.reduce((sum: number, payment: any) => sum + Number(payment.netAmount), 0);
  }
}

export default new PaymentRepository();
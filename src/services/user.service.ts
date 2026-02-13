import prisma from '@/config/database';
import { UserRole } from '@/types/enums';
import logger from '@/utils/logger';

export class UserService {
  
  async getUserById(id: string) {
    return await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        fullName: true,
        phone: true,
        role: true,
        status: true,
        profileImageUrl: true,
        emailVerified: true,
        phoneVerified: true,
        createdAt: true
      }
    });
  }

  async updateUser(id: string, data: {
    fullName?: string;
    phone?: string;
    profileImageUrl?: string;
  }) {
    return await prisma.user.update({
      where: { id },
      data
    });
  }

  async getUserStats(userId: string, role: UserRole) {
    if (role === 'customer') {
      return await this.getCustomerStats(userId);
    } else if (role === 'owner') {
      return await this.getOwnerStats(userId);
    }
    return null;
  }

  private async getCustomerStats(userId: string) {
    const [totalReservations, activeReservations, totalSpent] = await Promise.all([
      prisma.reservation.count({
        where: { userId }
      }),
      prisma.reservation.count({
        where: { userId, status: { in: ['confirmed', 'active'] } }
      }),
      prisma.payment.aggregate({
        where: {
          userId,
          paymentType: 'reservation',
          status: 'completed'
        },
        _sum: { amount: true }
      })
    ]);

    return {
      totalReservations,
      activeReservations,
      totalSpent: totalSpent._sum.amount || 0
    };
  }

  private async getOwnerStats(userId: string) {
    const [totalParkings, totalReservations, totalRevenue] = await Promise.all([
      prisma.parkingLot.count({
        where: { ownerId: userId, status: { not: 'inactive' } }
      }),
      prisma.reservation.count({
        where: {
          parkingLot: { ownerId: userId }
        }
      }),
      prisma.payment.aggregate({
        where: {
          reservation: {
            parkingLot: { ownerId: userId }
          },
          status: 'completed'
        },
        _sum: { netAmount: true }
      })
    ]);

    return {
      totalParkings,
      totalReservations,
      totalRevenue: totalRevenue._sum.netAmount || 0
    };
  }
}

export default new UserService();
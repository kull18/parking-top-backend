import prisma from '@/config/database';

export class UserRepository {

  async findById(userId: string) {
    return await prisma.user.findUnique({
      where: { id: userId },
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
        createdAt: true,
        lastLoginAt: true
      }
    });
  }

  async update(userId: string, data: {
    fullName?: string;
    phone?: string;
    profileImageUrl?: string;
    passwordHash?: string;
    lastLoginAt?: Date;
    emailVerified?: boolean;
    phoneVerified?: boolean;
    status?: string;
  }) {
    return await prisma.user.update({
      where: { id: userId },
      data
    });
  }

  async countReservations(userId: string) {
    return await prisma.reservation.count({
      where: { userId }
    });
  }

  async countActiveReservations(userId: string) {
    return await prisma.reservation.count({
      where: { userId, status: 'active' }
    });
  }

  async getTotalSpent(userId: string) {
    const result = await prisma.payment.aggregate({
      where: { userId, status: 'completed' },
      _sum: { amount: true }
    });

    return Number(result._sum.amount) || 0;
  }

  async countParkingsByOwner(ownerId: string) {
    return await prisma.parkingLot.count({
      where: { ownerId, status: { not: 'inactive' } }
    });
  }

  async countReservationsByOwner(ownerId: string) {
    return await prisma.reservation.count({
      where: {
        parkingLot: { ownerId }
      }
    });
  }

  async getTotalRevenueByOwner(ownerId: string) {
    const result = await prisma.payment.aggregate({
      where: {
        reservation: {
          parkingLot: { ownerId }
        },
        status: 'completed'
      },
      _sum: { netAmount: true }
    });

    return Number(result._sum.netAmount) || 0;
  }
}

export default new UserRepository();
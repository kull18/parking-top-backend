// src/repositories/owner-balance.repository.ts
import prisma from '@/config/database';

export class OwnerBalanceRepository {

  /**
   * Buscar balance por userId
   */
  async findByUserId(userId: string) {
    return await prisma.ownerBalance.findUnique({
      where: { userId }
    });
  }

  /**
   * Crear balance para un propietario
   */
  async create(userId: string) {
    return await prisma.ownerBalance.create({
      data: {
        userId,
        availableBalance: 0,
        pendingBalance: 0,
        totalEarnings: 0,
        totalWithdrawn: 0
      }
    });
  }

  /**
   * Obtener o crear balance
   */
  async getOrCreate(userId: string) {
    let balance = await this.findByUserId(userId);
    
    if (!balance) {
      balance = await this.create(userId);
    }
    
    return balance;
  }

  /**
   * Incrementar balance disponible (cuando se completa una reserva)
   */
  async incrementAvailable(userId: string, amount: number) {
    return await prisma.ownerBalance.update({
      where: { userId },
      data: {
        availableBalance: { increment: amount },
        totalEarnings: { increment: amount }
      }
    });
  }

  /**
   * Mover de disponible a pendiente (cuando se solicita payout)
   */
  async moveToPending(userId: string, amount: number) {
    return await prisma.ownerBalance.update({
      where: { userId },
      data: {
        availableBalance: { decrement: amount },
        pendingBalance: { increment: amount }
      }
    });
  }

  /**
   * Mover de pendiente a retirado (cuando se completa payout)
   */
  async moveToWithdrawn(userId: string, amount: number) {
    return await prisma.ownerBalance.update({
      where: { userId },
      data: {
        pendingBalance: { decrement: amount },
        totalWithdrawn: { increment: amount }
      }
    });
  }

  /**
   * Devolver de pendiente a disponible (cuando se rechaza payout)
   */
  async returnToAvailable(userId: string, amount: number) {
    return await prisma.ownerBalance.update({
      where: { userId },
      data: {
        pendingBalance: { decrement: amount },
        availableBalance: { increment: amount }
      }
    });
  }

  /**
   * Obtener balances de todos los propietarios
   */
  async findAll(skip: number = 0, take: number = 20) {
    return await Promise.all([
      prisma.ownerBalance.findMany({
        skip,
        take,
        include: {
          user: {
            select: {
              id: true,
              email: true,
              fullName: true
            }
          }
        },
        orderBy: { totalEarnings: 'desc' }
      }),
      prisma.ownerBalance.count()
    ]);
  }
}

export default new OwnerBalanceRepository();
// src/services/balance.service.ts
import ownerBalanceRepository from '@/repositories/owner-balance.repository';
import paymentRepository from '@/repositories/payment.repository';
import reservationRepository from '@/repositories/reservation.repository';
import logger from '@/utils/logger';
import prisma from '@/config/database';

export class BalanceService {

  /**
   * Obtener balance del propietario
   */
  async getOwnerBalance(userId: string) {
    const balance = await ownerBalanceRepository.getOrCreate(userId);
    
    return {
      availableBalance: Number(balance.availableBalance),
      pendingBalance: Number(balance.pendingBalance),
      totalEarnings: Number(balance.totalEarnings),
      totalWithdrawn: Number(balance.totalWithdrawn),
      netEarnings: Number(balance.totalEarnings) - Number(balance.totalWithdrawn)
    };
  }

  /**
   * Calcular y actualizar balance basado en reservas completadas
   */
  async calculateOwnerBalance(userId: string) {
    try {
      // Obtener todas las reservas completadas del propietario
      const completedReservations = await prisma.reservation.findMany({
        where: {
          parkingLot: {
            ownerId: userId
          },
          status: 'completed'
        },
        include: {
          parkingLot: true
        }
      });

      // Calcular total ganado (total - comisión)
      let totalEarnings = 0;

      for (const reservation of completedReservations) {
        const netAmount = Number(reservation.totalCost) - Number(reservation.commissionAmount);
        totalEarnings += netAmount;
      }

      // Obtener o crear balance
      const balance = await ownerBalanceRepository.getOrCreate(userId);

      // Calcular cuánto es nuevo (no contado antes)
      const currentTotal = Number(balance.totalEarnings);
      const newEarnings = totalEarnings - currentTotal;

      if (newEarnings > 0) {
        // Incrementar balance disponible
        await ownerBalanceRepository.incrementAvailable(userId, newEarnings);
        
        logger.info(`Balance updated for owner ${userId}: +$${newEarnings}`);
      }

      return await this.getOwnerBalance(userId);
    } catch (error) {
      logger.error('Error calculating owner balance:', error);
      throw error;
    }
  }

  /**
   * Recalcular balances de todos los propietarios (cron job)
   */
  async recalculateAllBalances() {
    try {
      // Obtener todos los propietarios con estacionamientos
      const owners = await prisma.user.findMany({
        where: {
          role: 'owner',
          parkingLots: {
            some: {}
          }
        },
        select: { id: true, fullName: true }
      });

      let updated = 0;

      for (const owner of owners) {
        await this.calculateOwnerBalance(owner.id);
        updated++;
      }

      logger.info(`Recalculated balances for ${updated} owners`);

      return {
        ownersProcessed: updated
      };
    } catch (error) {
      logger.error('Error recalculating all balances:', error);
      throw error;
    }
  }

  /**
   * Obtener estadísticas generales de balances (admin)
   */
  async getBalanceStats() {
    const balances = await prisma.ownerBalance.findMany();

    const totalAvailable = balances.reduce(
      (sum, b) => sum + Number(b.availableBalance),
      0
    );

    const totalPending = balances.reduce(
      (sum, b) => sum + Number(b.pendingBalance),
      0
    );

    const totalEarnings = balances.reduce(
      (sum, b) => sum + Number(b.totalEarnings),
      0
    );

    const totalWithdrawn = balances.reduce(
      (sum, b) => sum + Number(b.totalWithdrawn),
      0
    );

    return {
      totalOwners: balances.length,
      totalAvailable,
      totalPending,
      totalEarnings,
      totalWithdrawn,
      platformRevenue: totalEarnings - totalWithdrawn - totalPending - totalAvailable
    };
  }

  /**
   * Obtener top propietarios por ganancias (admin)
   */
  async getTopEarners(limit: number = 10) {
    const [balances] = await ownerBalanceRepository.findAll(0, limit);
    
    return balances.map(balance => ({
      userId: balance.userId,
      owner: balance.user,
      totalEarnings: Number(balance.totalEarnings),
      totalWithdrawn: Number(balance.totalWithdrawn),
      availableBalance: Number(balance.availableBalance),
      netEarnings: Number(balance.totalEarnings) - Number(balance.totalWithdrawn)
    }));
  }
}

export default new BalanceService();
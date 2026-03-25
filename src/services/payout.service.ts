// src/services/payout.service.ts
import payoutRepository from '@/repositories/payout.repository';
import ownerBalanceRepository from '@/repositories/owner-balance.repository';
import balanceService from '@/services/balance.service';
import notificationService from '@/services/notification.service';
import mercadopagoService from '@/integrations/mercadopago.client';
import { PayoutStatus } from '@/types/enums';
import logger from '@/utils/logger';
import prisma from '@/config/database';

export class PayoutService {

  /**
   * Solicitar retiro
   */
  async requestPayout(userId: string, data: {
    amount: number;
    bankAccount?: string;
    accountHolder?: string;
    notes?: string;
  }) {
    try {
      // Validar que sea propietario
      const user = await prisma.user.findUnique({
        where: { id: userId }
      });

      if (!user || user.role !== 'owner') {
        throw new Error('ONLY_OWNERS_CAN_REQUEST_PAYOUTS');
      }

      // Actualizar balance primero
      await balanceService.calculateOwnerBalance(userId);

      // Obtener balance
      const balance = await ownerBalanceRepository.findByUserId(userId);

      if (!balance) {
        throw new Error('BALANCE_NOT_FOUND');
      }

      // Validar monto mínimo (por ejemplo, $100)
      if (data.amount < 100) {
        throw new Error('MINIMUM_PAYOUT_AMOUNT');
      }

      // Validar que tenga suficiente balance
      if (Number(balance.availableBalance) < data.amount) {
        throw new Error('INSUFFICIENT_BALANCE');
      }

      // Mover dinero de disponible a pendiente
      await ownerBalanceRepository.moveToPending(userId, data.amount);

      // Crear solicitud de payout
      const payout = await payoutRepository.create({
        userId,
        amount: data.amount,
        bankAccount: data.bankAccount,
        accountHolder: data.accountHolder,
        notes: data.notes
      });

      // Notificar al propietario
      await notificationService.create({
        userId,
        type: 'general' as any,
        title: 'Solicitud de retiro recibida',
        message: `Tu solicitud de retiro por $${data.amount} MXN está en revisión.`
      });

      logger.info(`Payout requested: ${payout.id} - $${data.amount} by user ${userId}`);

      return payout;
    } catch (error) {
      logger.error('Error requesting payout:', error);
      throw error;
    }
  }

  /**
   * Listar payouts del propietario
   */
  async getOwnerPayouts(userId: string, page: number = 1, perPage: number = 20) {
    const skip = (page - 1) * perPage;
    const [payouts, total] = await payoutRepository.findByUserId(userId, skip, perPage);

    return {
      payouts,
      pagination: {
        page,
        perPage,
        total,
        totalPages: Math.ceil(total / perPage)
      }
    };
  }

  /**
   * Listar todos los payouts (admin)
   */
  async getAllPayouts(
    page: number = 1,
    perPage: number = 20,
    status?: PayoutStatus
  ) {
    const skip = (page - 1) * perPage;
    const [payouts, total] = await payoutRepository.findAll(skip, perPage, status);

    return {
      payouts,
      pagination: {
        page,
        perPage,
        total,
        totalPages: Math.ceil(total / perPage)
      }
    };
  }

  /**
   * Aprobar payout (admin)
   */
  async approvePayout(payoutId: string, adminId: string) {
    try {
      const payout = await payoutRepository.findById(payoutId);

      if (!payout) {
        throw new Error('PAYOUT_NOT_FOUND');
      }

      if (payout.status !== PayoutStatus.PENDING) {
        throw new Error('PAYOUT_NOT_PENDING');
      }

      // Actualizar a aprobado
      const updated = await payoutRepository.update(payoutId, {
        status: PayoutStatus.APPROVED,
        approvedBy: adminId,
        processedAt: new Date()
      });

      // Notificar al propietario
      await notificationService.create({
        userId: payout.userId,
        type: 'general' as any,
        title: 'Retiro aprobado',
        message: `Tu retiro de $${payout.amount} MXN ha sido aprobado y se procesará pronto.`
      });

      logger.info(`Payout approved: ${payoutId} by admin ${adminId}`);

      // Procesar transferencia automáticamente
      await this.processTransfer(payoutId);

      return updated;
    } catch (error) {
      logger.error('Error approving payout:', error);
      throw error;
    }
  }

  /**
   * Rechazar payout (admin)
   */
  async rejectPayout(payoutId: string, adminId: string, reason: string) {
    try {
      const payout = await payoutRepository.findById(payoutId);

      if (!payout) {
        throw new Error('PAYOUT_NOT_FOUND');
      }

      if (payout.status !== PayoutStatus.PENDING) {
        throw new Error('PAYOUT_NOT_PENDING');
      }

      // Devolver dinero a balance disponible
      await ownerBalanceRepository.returnToAvailable(
        payout.userId,
        Number(payout.amount)
      );

      // Actualizar a rechazado
      const updated = await payoutRepository.update(payoutId, {
        status: PayoutStatus.REJECTED,
        approvedBy: adminId,
        rejectedAt: new Date(),
        rejectionReason: reason
      });

      // Notificar al propietario
      await notificationService.create({
        userId: payout.userId,
        type: 'general' as any,
        title: 'Retiro rechazado',
        message: `Tu solicitud de retiro de $${payout.amount} MXN fue rechazada. Motivo: ${reason}`
      });

      logger.info(`Payout rejected: ${payoutId} by admin ${adminId}`);

      return updated;
    } catch (error) {
      logger.error('Error rejecting payout:', error);
      throw error;
    }
  }

  /**
   * Procesar transferencia vía MercadoPago
   */
  async processTransfer(payoutId: string) {
    try {
      const payout = await payoutRepository.findById(payoutId);

      if (!payout) {
        throw new Error('PAYOUT_NOT_FOUND');
      }

      if (payout.status !== PayoutStatus.APPROVED) {
        throw new Error('PAYOUT_NOT_APPROVED');
      }

      // Actualizar a procesando
      await payoutRepository.update(payoutId, {
        status: PayoutStatus.PROCESSING
      });

      // TODO: Integración real con MercadoPago Money Out
      // Por ahora simularemos que se completó
      // En producción aquí irían las llamadas a la API de MercadoPago

      // Simular procesamiento exitoso
      const mpTransferId = `mp_transfer_${Date.now()}`;

      // Mover dinero de pendiente a retirado
      await ownerBalanceRepository.moveToWithdrawn(
        payout.userId,
        Number(payout.amount)
      );

      // Actualizar a completado
      const updated = await payoutRepository.update(payoutId, {
        status: PayoutStatus.COMPLETED,
        mpTransferId,
        completedAt: new Date()
      });

      // Notificar al propietario
      await notificationService.create({
        userId: payout.userId,
        type: 'payment_received' as any,
        title: 'Retiro completado',
        message: `Tu retiro de $${payout.amount} MXN ha sido transferido exitosamente.`
      });

      logger.info(`Payout completed: ${payoutId} - Transfer ID: ${mpTransferId}`);

      return updated;
    } catch (error) {
      logger.error('Error processing transfer:', error);

      // Marcar como fallido
      await payoutRepository.update(payoutId, {
        status: PayoutStatus.FAILED
      });

      throw error;
    }
  }

  /**
   * Obtener estadísticas de payouts (admin)
   */
  async getPayoutStats() {
    const counts = await payoutRepository.countByStatus();
    const totalCompleted = await payoutRepository.getTotalCompleted();

    return {
      byStatus: counts,
      totalCompleted,
      totalPending: counts[PayoutStatus.PENDING] || 0,
      totalApproved: counts[PayoutStatus.APPROVED] || 0,
      totalRejected: counts[PayoutStatus.REJECTED] || 0
    };
  }

  /**
   * Procesar payouts aprobados (cron job)
   */
  async processApprovedPayouts() {
    try {
      const approvedPayouts = await payoutRepository.findApprovedNotProcessed();

      let processed = 0;

      for (const payout of approvedPayouts) {
        try {
          await this.processTransfer(payout.id);
          processed++;
        } catch (error) {
          logger.error(`Failed to process payout ${payout.id}:`, error);
        }
      }

      logger.info(`Processed ${processed} approved payouts`);

      return {
        processed
      };
    } catch (error) {
      logger.error('Error processing approved payouts:', error);
      throw error;
    }
  }

  /**
   * Obtener detalles de payout
   */
  async getPayoutById(payoutId: string, userId?: string) {
    const payout = await payoutRepository.findById(payoutId);

    if (!payout) {
      throw new Error('PAYOUT_NOT_FOUND');
    }

    // Si se proporciona userId, verificar que sea el dueño
    if (userId && payout.userId !== userId) {
      throw new Error('UNAUTHORIZED');
    }

    return payout;
  }
}

export default new PayoutService();
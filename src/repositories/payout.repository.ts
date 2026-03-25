// src/repositories/payout.repository.ts
import prisma from '@/config/database';
import { PayoutStatus } from '@/types/enums';

export class PayoutRepository {

  /**
   * Buscar payout por ID
   */
  async findById(id: string) {
    return await prisma.payout.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            fullName: true,
            phone: true
          }
        },
        approver: {
          select: {
            id: true,
            email: true,
            fullName: true
          }
        }
      }
    });
  }

  /**
   * Buscar payouts del propietario
   */
  async findByUserId(userId: string, skip: number = 0, take: number = 20) {
    return await Promise.all([
      prisma.payout.findMany({
        where: { userId },
        skip,
        take,
        orderBy: { createdAt: 'desc' }
      }),
      prisma.payout.count({ where: { userId } })
    ]);
  }

  /**
   * Crear solicitud de payout
   */
  async create(data: {
    userId: string;
    amount: number;
    bankAccount?: string;
    accountHolder?: string;
    notes?: string;
  }) {
    return await prisma.payout.create({
      data: {
        userId: data.userId,
        amount: data.amount,
        status: PayoutStatus.PENDING,
        bankAccount: data.bankAccount,
        accountHolder: data.accountHolder,
        notes: data.notes
      },
      include: {
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

  /**
   * Actualizar payout
   */
  async update(id: string, data: Partial<{
    status: PayoutStatus;
    processedAt: Date;
    completedAt: Date;
    rejectedAt: Date;
    rejectionReason: string;
    mpTransferId: string;
    approvedBy: string;
  }>) {
    return await prisma.payout.update({
      where: { id },
      data,
      include: {
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

  /**
   * Listar todos los payouts (admin)
   */
  async findAll(
    skip: number = 0,
    take: number = 20,
    status?: PayoutStatus
  ) {
    const where = status ? { status } : {};

    return await Promise.all([
      prisma.payout.findMany({
        where,
        skip,
        take,
        include: {
          user: {
            select: {
              id: true,
              email: true,
              fullName: true,
              phone: true
            }
          },
          approver: {
            select: {
              id: true,
              fullName: true
            }
          }
        },
        orderBy: { createdAt: 'desc' }
      }),
      prisma.payout.count({ where })
    ]);
  }

  /**
   * Buscar payouts pendientes
   */
  async findPending() {
    return await prisma.payout.findMany({
      where: { status: PayoutStatus.PENDING },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            fullName: true,
            phone: true
          }
        }
      },
      orderBy: { createdAt: 'asc' }
    });
  }

  /**
   * Buscar payouts aprobados pero no procesados
   */
  async findApprovedNotProcessed() {
    return await prisma.payout.findMany({
      where: { status: PayoutStatus.APPROVED },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            fullName: true,
            phone: true
          }
        }
      },
      orderBy: { processedAt: 'asc' }
    });
  }

  /**
   * Contar payouts por estado
   */
  async countByStatus() {
    const results = await prisma.payout.groupBy({
      by: ['status'],
      _count: true
    });

    return results.reduce((acc, item) => {
      acc[item.status] = item._count;
      return acc;
    }, {} as Record<string, number>);
  }

  /**
   * Total de payouts completados
   */
  async getTotalCompleted(userId?: string) {
    const where: any = { status: PayoutStatus.COMPLETED };
    
    if (userId) {
      where.userId = userId;
    }

    const result = await prisma.payout.aggregate({
      where,
      _sum: { amount: true }
    });

    return Number(result._sum.amount || 0);
  }
}

export default new PayoutRepository();
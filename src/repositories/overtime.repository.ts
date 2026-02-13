import prisma from '@/config/database';

export class OvertimeRepository {
  
  async findById(id: string) {
    return await prisma.overtimeCharge.findUnique({
      where: { id },
      include: {
        reservation: {
          include: {
            parkingLot: true,
            user: true
          }
        }
      }
    });
  }

  async findByReservationId(reservationId: string) {
    return await prisma.overtimeCharge.findFirst({
      where: { reservationId }
    });
  }

  async findUnpaidByReservationId(reservationId: string) {
    return await prisma.overtimeCharge.findFirst({
      where: {
        reservationId,
        isPaid: false
      }
    });
  }

  async create(data: {
    reservationId: string;
    hoursOvertime: number;
    ratePerHour: number;
    totalCharge: number;
    isPaid?: boolean;
  }) {
    return await prisma.overtimeCharge.create({
      data: {
        ...data,
        isPaid: data.isPaid ?? false
      }
    });
  }

  async update(id: string, data: {
    hoursOvertime?: number;
    ratePerHour?: number;
    totalCharge?: number;
    isPaid?: boolean;
    paidAt?: Date;
  }) {
    return await prisma.overtimeCharge.update({
      where: { id },
      data
    });
  }

  async markAsPaid(overtimeChargeId: string) {
    return await prisma.overtimeCharge.update({
      where: { id: overtimeChargeId },
      data: {
        isPaid: true,
        paidAt: new Date()
      }
    });
  }

  async findByParkingLotAndDateRange(
    parkingLotId: string,
    startDate: Date,
    endDate: Date
  ) {
    return await prisma.overtimeCharge.findMany({
      where: {
        reservation: {
          parkingLotId,
          endTime: {
            gte: startDate,
            lte: endDate
          }
        }
      },
      include: {
        reservation: {
          include: {
            user: {
              select: {
                id: true,
                fullName: true,
                email: true,
                phone: true
              }
            },
            parkingLot: {
              select: {
                id: true,
                name: true,
                address: true
              }
            }
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
  }

  async findUnpaidOvertimes() {
    return await prisma.overtimeCharge.findMany({
      where: {
        isPaid: false
      },
      include: {
        reservation: {
          include: {
            user: true,
            parkingLot: true
          }
        }
      }
    });
  }

  async findByUserId(userId: string) {
    return await prisma.overtimeCharge.findMany({
      where: {
        reservation: {
          userId
        }
      },
      include: {
        reservation: {
          include: {
            parkingLot: {
              select: {
                id: true,
                name: true
              }
            }
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
  }

  async getTotalRevenueByParkingLot(parkingLotId: string, startDate?: Date, endDate?: Date) {
    const where: any = {
      reservation: {
        parkingLotId
      },
      isPaid: true
    };

    if (startDate || endDate) {
      where.paidAt = {};
      if (startDate) where.paidAt.gte = startDate;
      if (endDate) where.paidAt.lte = endDate;
    }

    const result = await prisma.overtimeCharge.aggregate({
      where,
      _sum: {
        totalCharge: true
      },
      _count: true
    });

    return {
      totalRevenue: Number(result._sum.totalCharge) || 0,
      totalCharges: result._count
    };
  }

  async getStatsByOwner(ownerId: string, startDate?: Date, endDate?: Date) {
    const where: any = {
      reservation: {
        parkingLot: {
          ownerId
        }
      }
    };

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = startDate;
      if (endDate) where.createdAt.lte = endDate;
    }

    const [total, paid, unpaid] = await Promise.all([
      prisma.overtimeCharge.aggregate({
        where,
        _sum: { totalCharge: true, hoursOvertime: true },
        _count: true
      }),
      prisma.overtimeCharge.aggregate({
        where: { ...where, isPaid: true },
        _sum: { totalCharge: true },
        _count: true
      }),
      prisma.overtimeCharge.aggregate({
        where: { ...where, isPaid: false },
        _sum: { totalCharge: true },
        _count: true
      })
    ]);

    return {
      totalCharges: total._count,
      totalHours: Number(total._sum.hoursOvertime) || 0,
      totalRevenue: Number(total._sum.totalCharge) || 0,
      paidCharges: paid._count,
      paidRevenue: Number(paid._sum.totalCharge) || 0,
      unpaidCharges: unpaid._count,
      unpaidRevenue: Number(unpaid._sum.totalCharge) || 0
    };
  }

  async deleteByReservationId(reservationId: string) {
    return await prisma.overtimeCharge.deleteMany({
      where: { reservationId }
    });
  }
}

export default new OvertimeRepository();
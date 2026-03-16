// src/repositories/review.repository.ts
import prisma from '@/config/database';

export class ReviewRepository {
  
  /**
   * Buscar reseña por ID
   */
  async findById(id: string) {
    return await prisma.review.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            fullName: true
          }
        },
        parkingLot: {
          select: {
            id: true,
            name: true,
            address: true,
            ownerId: true
          }
        }
      }
    });
  }

  /**
   * Buscar reseña por usuario y reserva
   */
  async findByUserAndReservation(userId: string, reservationId: string) {
    return await prisma.review.findUnique({
      where: {
        userId_reservationId: {
          userId,
          reservationId
        }
      }
    });
  }

  /**
   * Buscar todas las reseñas de un estacionamiento
   */
  async findByParkingLot(parkingLotId: string, skip: number, take: number) {
    return await Promise.all([
      prisma.review.findMany({
        where: { parkingLotId },
        include: {
          user: {
            select: {
              id: true,
              fullName: true
            }
          }
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take
      }),
      prisma.review.count({
        where: { parkingLotId }
      })
    ]);
  }

  /**
   * Buscar todas las reseñas de un usuario
   */
  async findByUser(userId: string, skip: number, take: number) {
    return await Promise.all([
      prisma.review.findMany({
        where: { userId },
        include: {
          parkingLot: {
            select: {
              id: true,
              name: true,
              address: true,
              city: true
            }
          }
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take
      }),
      prisma.review.count({
        where: { userId }
      })
    ]);
  }

  /**
   * Crear nueva reseña
   */
  async create(data: {
    userId: string;
    parkingLotId: string;
    reservationId: string;
    rating: number;
    comment?: string;
  }) {
    return await prisma.review.create({
      data,
      include: {
        user: {
          select: {
            id: true,
            fullName: true
          }
        }
      }
    });
  }

  /**
   * Actualizar reseña
   */
  async update(id: string, data: { rating?: number; comment?: string }) {
    return await prisma.review.update({
      where: { id },
      data,
      include: {
        user: {
          select: {
            id: true,
            fullName: true
          }
        }
      }
    });
  }

  /**
   * Agregar respuesta del propietario
   */
  async addOwnerResponse(id: string, response: string) {
    return await prisma.review.update({
      where: { id },
      data: {
        ownerResponse: response,
        ownerResponseAt: new Date()
      },
      include: {
        user: {
          select: {
            id: true,
            fullName: true
          }
        }
      }
    });
  }

  /**
   * Eliminar reseña
   */
  async delete(id: string) {
    return await prisma.review.delete({
      where: { id }
    });
  }

  /**
   * Obtener todas las reseñas de un estacionamiento (para calcular rating)
   */
  async findRatingsByParkingLot(parkingLotId: string) {
    return await prisma.review.findMany({
      where: { parkingLotId },
      select: { rating: true }
    });
  }

  /**
   * Contar reseñas de un estacionamiento
   */
  async countByParkingLot(parkingLotId: string) {
    return await prisma.review.count({
      where: { parkingLotId }
    });
  }
}

export default new ReviewRepository();
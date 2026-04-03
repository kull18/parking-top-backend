import prisma from '@/config/database';
import parkingRepository from '@/repositories/parking.repository';
import { ParkingStatus } from '@/types/enums';
import logger from '@/utils/logger';
import { calculateDistance } from '@/utils/helpers';

type ParkingFromRepo = Awaited<ReturnType<typeof parkingRepository.findActive>>[0];

type ParkingWithDistance = ParkingFromRepo & {
  distance: number;
};

export class ParkingService {
  
  async getNearby(latitude: number, longitude: number, radius: number = 5000) {
    try {
      const parkings = await parkingRepository.findActive();

      const nearbyParkings = parkings
        .map((parking: ParkingFromRepo): ParkingWithDistance => ({
          ...parking,
          distance: calculateDistance(
            latitude,
            longitude,
            Number(parking.latitude),
            Number(parking.longitude)
          )
        }))
        .filter((parking: ParkingWithDistance) => parking.distance <= radius)
        .sort((a: ParkingWithDistance, b: ParkingWithDistance) => a.distance - b.distance);

      return nearbyParkings;
    } catch (error) {
      logger.error('Error getting nearby parkings:', error);
      throw error;
    }
  }

  async getParkinkLots() {
    return await parkingRepository.getParkingLots();
  }

  async getById(id: string) {
    return await parkingRepository.findById(id);
  }

  async create(ownerId: string, data: any) {
    try {
      // Verificar suscripción activa
      const subscription = await prisma.subscription.findFirst({
        where: {
          userId: ownerId,
          status: { in: ['active', 'trial'] }
        },
        include: { plan: true }
      });

      if (!subscription) {
        throw new Error('Necesitas una suscripción activa');
      }

      // Verificar límites
      const currentCount = await parkingRepository.countByOwnerId(ownerId);

      if (
        subscription.plan.maxParkingLots !== null &&
        currentCount >= subscription.plan.maxParkingLots
      ) {
        throw new Error(
          `Has alcanzado el límite de ${subscription.plan.maxParkingLots} estacionamientos`
        );
      }

      if (
        subscription.plan.maxSpotsPerLot !== null &&
        data.totalSpots > subscription.plan.maxSpotsPerLot
      ) {
        throw new Error(
          `Tu plan solo permite ${subscription.plan.maxSpotsPerLot} espacios por estacionamiento`
        );
      }

      // ✅ CAMBIO AQUÍ: Crear estacionamiento en estado ACTIVE
      const parking = await parkingRepository.create({
        ...data,
        ownerId,
        subscriptionId: subscription.id,
        availableSpots: data.totalSpots,
        status: ParkingStatus.ACTIVE,  // ✅ Activo directamente
        subscriptionVerifiedAt: new Date(),
        approvedAt: new Date()  // ✅ Fecha de aprobación automática
      });

      // Crear espacios
      const spots = Array.from({ length: data.totalSpots }, (_, i) => ({
        parkingLotId: parking.id,
        spotNumber: String(i + 1),
        status: 'available' as const,
        vehicleType: 'car' as const
      }));

      await prisma.parkingSpot.createMany({
        data: spots
      });

      logger.info(`Parking created and activated: ${parking.id} by owner ${ownerId}`);
      return parking;
    } catch (error: any) {
      logger.error('Error creating parking:', error);
      throw error;
    }
  }

  async update(id: string, ownerId: string, data: any) {
    const parking = await parkingRepository.findById(id);

    if (!parking) {
      throw new Error('Estacionamiento no encontrado');
    }

    if (parking.owner.id !== ownerId) {
      throw new Error('No tienes permiso para editar este estacionamiento');
    }

    return await parkingRepository.update(id, data);
  }

  async delete(id: string, ownerId: string) {
    const parking = await parkingRepository.findById(id);

    if (!parking) {
      throw new Error('Estacionamiento no encontrado');
    }

    if (parking.owner.id !== ownerId) {
      throw new Error('No tienes permiso para eliminar este estacionamiento');
    }

    return await parkingRepository.update(id, {
      status: ParkingStatus.INACTIVE
    });
  }

  async getOwnerParkings(ownerId: string) {
    return await parkingRepository.findByOwnerId(ownerId);
  }

  async checkAvailability(parkingId: string, startTime: Date, endTime: Date) {
    const parking = await parkingRepository.findById(parkingId);

    if (!parking) {
      throw new Error('Estacionamiento no encontrado');
    }

    const overlappingReservations = await prisma.reservation.count({
      where: {
        parkingLotId: parkingId,
        status: { in: ['confirmed', 'active'] },
        OR: [
          {
            AND: [
              { startTime: { lte: startTime } },
              { endTime: { gt: startTime } }
            ]
          },
          {
            AND: [
              { startTime: { lt: endTime } },
              { endTime: { gte: endTime } }
            ]
          },
          {
            AND: [
              { startTime: { gte: startTime } },
              { endTime: { lte: endTime } }
            ]
          }
        ]
      }
    });

    const availableSpots = parking.totalSpots - overlappingReservations;

    return {
      available: availableSpots > 0,
      availableSpots,
      totalSpots: parking.totalSpots
    };
  }
}

export default new ParkingService();
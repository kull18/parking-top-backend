import { ParkingLot } from '@prisma/client';

export function isOperatingNow(parking: ParkingLot): boolean {
  const now = new Date();
  const dayOfWeek = now.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
  const currentTime = now.toTimeString().slice(0, 5); // HH:MM

  const hours = (parking.operatingHours as any)[dayOfWeek];
  
  if (!hours) return false;

  return currentTime >= hours.open && currentTime <= hours.close;
}

export function calculateOccupancyRate(parking: ParkingLot): number {
  if (parking.totalSpots === 0) return 0;
  
  const occupied = parking.totalSpots - parking.availableSpots;
  return (occupied / parking.totalSpots) * 100;
}
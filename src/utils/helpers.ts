import dayjs from 'dayjs';

export const generateReservationCode = (): string => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = 'PK';
      
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  
  return code;
};

export const calculateHoursBetween = (start: Date, end: Date): number => {
  return dayjs(end).diff(dayjs(start), 'hour', true);
};

export const calculateCost = (hours: number, ratePerHour: number): number => {
  return Math.round(hours * ratePerHour * 100) / 100;
};

export const calculateCommission = (amount: number, rate: number): number => {
  return Math.round(amount * (rate / 100) * 100) / 100;
};

export const isWithinGracePeriod = (endTime: Date, gracePeriodMinutes: number): boolean => {
  const now = new Date();
  const graceEnd = dayjs(endTime).add(gracePeriodMinutes, 'minute').toDate();
  return now <= graceEnd;
};

const toRad = (value: number): number => {
  return (value * Math.PI) / 180;
};


/**
 * Calcular distancia entre dos puntos usando la fórmula de Haversine
 * @param lat1 Latitud punto 1
 * @param lon1 Longitud punto 1
 * @param lat2 Latitud punto 2
 * @param lon2 Longitud punto 2
 * @returns Distancia en metros
 */
export function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371e3; // Radio de la Tierra en metros
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  const distance = R * c; // Distancia en metros

  return Math.round(distance); // Redondear a metros enteros
}
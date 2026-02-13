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

export const calculateDistance = (
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number => {
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c * 1000;
  
  return Math.round(distance);
};

const toRad = (value: number): number => {
  return (value * Math.PI) / 180;
};
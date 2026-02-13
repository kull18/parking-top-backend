import { Reservation } from '@prisma/client';
import dayjs from 'dayjs';

export function isActive(reservation: Reservation): boolean {
  return reservation.status === 'active';
}

export function isCompleted(reservation: Reservation): boolean {
  return reservation.status === 'completed';
}

export function isOvertime(reservation: Reservation): boolean {
  if (reservation.status !== 'active') return false;
  return dayjs().isAfter(dayjs(reservation.endTime));
}

export function getOvertimeMinutes(reservation: Reservation): number {
  if (!isOvertime(reservation)) return 0;
  return dayjs().diff(dayjs(reservation.endTime), 'minute');
}
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import isBetweenPlugin from 'dayjs/plugin/isBetween';

dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(isBetweenPlugin);

export const DEFAULT_TIMEZONE = 'America/Mexico_City';

export function formatDate(date: Date | string, format: string = 'YYYY-MM-DD'): string {
  return dayjs(date).format(format);
}

export function formatDateTime(date: Date | string): string {
  return dayjs(date).format('YYYY-MM-DD HH:mm:ss');
}

export function formatTime(date: Date | string): string {
  return dayjs(date).format('HH:mm');
}

export function addHours(date: Date, hours: number): Date {
  return dayjs(date).add(hours, 'hour').toDate();
}

export function addDays(date: Date, days: number): Date {
  return dayjs(date).add(days, 'day').toDate();
}

export function subtractHours(date: Date, hours: number): Date {
  return dayjs(date).subtract(hours, 'hour').toDate();
}

export function isAfter(date1: Date, date2: Date): boolean {
  return dayjs(date1).isAfter(dayjs(date2));
}

export function isBefore(date1: Date, date2: Date): boolean {
  return dayjs(date1).isBefore(dayjs(date2));
}

export function isBetween(date: Date, start: Date, end: Date): boolean {
  return dayjs(date).isBetween(dayjs(start), dayjs(end), null, '[]');
}

export function getDiffInMinutes(start: Date, end: Date): number {
  return dayjs(end).diff(dayjs(start), 'minute');
}

export function getDiffInHours(start: Date, end: Date): number {
  return dayjs(end).diff(dayjs(start), 'hour', true);
}

export function getDiffInDays(start: Date, end: Date): number {
  return dayjs(end).diff(dayjs(start), 'day');
}

export function toMexicoTimezone(date: Date): Date {
  return dayjs(date).tz(DEFAULT_TIMEZONE).toDate();
}

export function startOfDay(date: Date): Date {
  return dayjs(date).startOf('day').toDate();
}

export function endOfDay(date: Date): Date {
  return dayjs(date).endOf('day').toDate();
}

export function isToday(date: Date): boolean {
  return dayjs(date).isSame(dayjs(), 'day');
}

export function isThisWeek(date: Date): boolean {
  return dayjs(date).isSame(dayjs(), 'week');
}

export function isThisMonth(date: Date): boolean {
  return dayjs(date).isSame(dayjs(), 'month');
}
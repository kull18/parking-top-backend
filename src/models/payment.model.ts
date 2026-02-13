import { Payment } from '@prisma/client';

export function isPending(payment: Payment): boolean {
  return payment.status === 'pending';
}

export function isCompleted(payment: Payment): boolean {
  return payment.status === 'completed';
}

export function isFailed(payment: Payment): boolean {
  return payment.status === 'failed';
}

export function getNetAmount(payment: Payment): number {
  return Number(payment.amount) - Number(payment.commissionAmount);
}
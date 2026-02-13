
import { User } from '@prisma/client';

export type UserPublic = Omit<User, 'passwordHash'>;

export function toUserPublic(user: User): UserPublic {
  const { passwordHash, ...publicUser } = user;
  return publicUser;
}

export function isOwner(user: User): boolean {
  return user.role === 'owner';
}

export function isCustomer(user: User): boolean {
  return user.role === 'customer';
}

export function isAdmin(user: User): boolean {
  return user.role === 'admin';
}
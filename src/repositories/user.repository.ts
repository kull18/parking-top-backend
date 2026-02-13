import prisma from '@/config/database';
import { UserRole, UserStatus } from '@/types/enums';

export class UserRepository {
  
  async findById(id: string) {
    return await prisma.user.findUnique({
      where: { id }
    });
  }

  async findByEmail(email: string) {
    return await prisma.user.findUnique({
      where: { email }
    });
  }

  async create(data: {
    email: string;
    passwordHash: string;
    fullName: string;
    phone?: string;
    role: UserRole;
  }) {
    return await prisma.user.create({
      data: {
        ...data,
        status: UserStatus.ACTIVE,
        emailVerified: false,
        phoneVerified: false
      }
    });
  }

  async update(id: string, data: any) {
    return await prisma.user.update({
      where: { id },
      data
    });
  }

  async updateLastLogin(id: string) {
    return await prisma.user.update({
      where: { id },
      data: { lastLoginAt: new Date() }
    });
  }

  async findAll(filters?: {
    role?: UserRole;
    status?: UserStatus;
    search?: string;
  }) {
    const where: any = {};

    if (filters?.role) where.role = filters.role;
    if (filters?.status) where.status = filters.status;
    if (filters?.search) {
      where.OR = [
        { email: { contains: filters.search, mode: 'insensitive' } },
        { fullName: { contains: filters.search, mode: 'insensitive' } }
      ];
    }

    return await prisma.user.findMany({
      where,
      orderBy: { createdAt: 'desc' }
    });
  }
}

export default new UserRepository();
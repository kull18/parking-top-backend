import prisma from '@/config/database';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { config } from '@/config/environment';
import logger from '@/utils/logger';

export class AuthService {

  async registerUser(data: {
    email: string;
    password: string;
    fullName: string;
    phone?: string;
    role?: string;
    profileImageUrl?: string;
  }) {
    // Verificar si el email ya existe
    const existingUser = await prisma.user.findUnique({
      where: { email: data.email }
    });

    if (existingUser) {
      throw new Error('EMAIL_TAKEN');
    }

    // Hashear password
    const passwordHash = await bcrypt.hash(data.password, config.security.bcryptRounds);

    // Crear usuario
    const user = await prisma.user.create({
      data: {
        email: data.email,
        passwordHash,
        fullName: data.fullName,
        phone: data.phone,
        role: data.role || 'customer',
        status: 'active',
        profileImageUrl: data.profileImageUrl,
        emailVerified: false,
        phoneVerified: false
      },
      select: {
        id: true,
        email: true,
        fullName: true,
        phone: true,
        role: true,
        status: true,
        profileImageUrl: true,
        emailVerified: true,
        createdAt: true
      }
    });

    logger.info(`User registered: ${user.id} (${user.email})`);

    return user;
  }

  async loginUser(email: string, password: string) {
    // Buscar usuario
    const user = await prisma.user.findUnique({ where: { email } });

    if (!user) {
      throw new Error('INVALID_CREDENTIALS');
    }

    if (user.status !== 'active') {
      throw new Error('ACCOUNT_SUSPENDED');
    }

    // Verificar password
    const isValid = await bcrypt.compare(password, user.passwordHash);

    if (!isValid) {
      throw new Error('INVALID_CREDENTIALS');
    }

    // Actualizar último login
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() }
    });

    logger.info(`User logged in: ${user.id}`);

    return {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      phone: user.phone,
      role: user.role,
      status: user.status,
      profileImageUrl: user.profileImageUrl,
      emailVerified: user.emailVerified,
      createdAt: user.createdAt
    };
  }

  async getUserById(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        fullName: true,
        phone: true,
        role: true,
        status: true,
        profileImageUrl: true,
        emailVerified: true,
        phoneVerified: true,
        createdAt: true,
        lastLoginAt: true
      }
    });

    if (!user) {
      throw new Error('USER_NOT_FOUND');
    }

    return user;
  }

  async updateUserProfile(userId: string, data: {
    fullName?: string;
    phone?: string;
    profileImageUrl?: string;
  }) {
    const updated = await prisma.user.update({
      where: { id: userId },
      data: {
        ...(data.fullName && { fullName: data.fullName }),
        ...(data.phone && { phone: data.phone }),
        ...(data.profileImageUrl && { profileImageUrl: data.profileImageUrl })
      },
      select: {
        id: true,
        email: true,
        fullName: true,
        phone: true,
        profileImageUrl: true,
        role: true,
        status: true
      }
    });

    return updated;
  }

  async changeUserPassword(userId: string, currentPassword: string, newPassword: string) {
    const user = await prisma.user.findUnique({ where: { id: userId } });

    if (!user) {
      throw new Error('USER_NOT_FOUND');
    }

    const isValid = await bcrypt.compare(currentPassword, user.passwordHash);

    if (!isValid) {
      throw new Error('WRONG_PASSWORD');
    }

    const newPasswordHash = await bcrypt.hash(newPassword, config.security.bcryptRounds);

    await prisma.user.update({
      where: { id: userId },
      data: { passwordHash: newPasswordHash }
    });

    logger.info(`Password changed for user: ${userId}`);
  }

  generateTokens(user: { id: string; email: string; role: string }) {
    const token = jwt.sign(
      { userId: user.id, email: user.email, role: user.role },
      config.jwt.secret,
      { expiresIn: config.jwt.expiresIn } as any
    );

    const refreshToken = jwt.sign(
      { userId: user.id },
      config.jwt.refreshSecret,
      { expiresIn: config.jwt.refreshExpiresIn } as any
    );

    return { token, refreshToken };
  }

  async refreshUserToken(refreshToken: string) {
    if (!refreshToken) {
      throw new Error('NO_TOKEN');
    }

    const payload = jwt.verify(refreshToken, config.jwt.refreshSecret) as { userId: string };

    const user = await prisma.user.findUnique({ where: { id: payload.userId } });

    if (!user || user.status !== 'active') {
      throw new Error('INVALID_TOKEN');
    }

    const newToken = jwt.sign(
      { userId: user.id, email: user.email, role: user.role },
      config.jwt.secret,
      { expiresIn: config.jwt.expiresIn } as any
    );

    return { token: newToken };
  }
}

export default new AuthService();
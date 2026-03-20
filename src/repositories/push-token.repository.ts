// src/repositories/push-token.repository.ts
import prisma from '@/config/database';

export class PushTokenRepository {

  /**
   * Buscar token por ID
   */
  async findById(id: string) {
    return await prisma.pushToken.findUnique({
      where: { id }
    });
  }

  /**
   * Buscar token por el token mismo
   */
  async findByToken(token: string) {
    return await prisma.pushToken.findUnique({
      where: { token }
    });
  }

  /**
   * Buscar token por usuario y plataforma
   */
  async findByUserAndPlatform(userId: string, platform: string) {
    return await prisma.pushToken.findFirst({
      where: {
        userId,
        platform,
        isActive: true
      }
    });
  }

  /**
   * Buscar tokens activos de un usuario
   */
  async findActiveByUser(userId: string) {
    return await prisma.pushToken.findMany({
      where: {
        userId,
        isActive: true
      }
    });
  }

  /**
   * Crear token
   */
  async create(data: {
    userId: string;
    token: string;
    platform: string;
  }) {
    return await prisma.pushToken.create({
      data: {
        userId: data.userId,
        token: data.token,
        platform: data.platform,
        isActive: true
      }
    });
  }

  /**
   * Actualizar token
   */
  async update(id: string, data: { token?: string; isActive?: boolean }) {
    return await prisma.pushToken.update({
      where: { id },
      data
    });
  }

  /**
   * Desactivar token
   */
  async deactivate(id: string) {
    return await prisma.pushToken.update({
      where: { id },
      data: { isActive: false }
    });
  }

  /**
   * Desactivar tokens inválidos
   */
  async deactivateInvalidTokens(tokens: string[]) {
    return await prisma.pushToken.updateMany({
      where: {
        token: { in: tokens }
      },
      data: { isActive: false }
    });
  }

  /**
   * Eliminar token
   */
  async delete(id: string) {
    return await prisma.pushToken.delete({
      where: { id }
    });
  }

  /**
   * Eliminar token por token string
   */
  async deleteByToken(token: string) {
    return await prisma.pushToken.deleteMany({
      where: { token }
    });
  }

  /**
   * Eliminar todos los tokens de un usuario
   */
  async deleteAllByUser(userId: string) {
    return await prisma.pushToken.deleteMany({
      where: { userId }
    });
  }
}

export default new PushTokenRepository();
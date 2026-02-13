import { Request, Response, NextFunction } from 'express';
import { AuthRequest } from '@/types/interfaces';
import prisma from '@/config/database';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import cloudinaryService from '@/integrations/cloudinary.client';
import { sendSuccess, sendError } from '@/utils/response';
import { config } from '@/config/environment';
import logger from '@/utils/logger';

export class AuthController {

  async register(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { email, password, fullName, phone, role } = req.body;
      const file = req.file as Express.Multer.File | undefined;

      // Verificar si el email ya existe
      const existingUser = await prisma.user.findUnique({ where: { email } });

      if (existingUser) {
        sendError(res, 'EMAIL_TAKEN', 'El email ya está registrado', 400);
        return;
      }

      // Subir imagen de perfil si se proporcionó
      let profileImageUrl: string | undefined;

      if (file) {
        const result = await cloudinaryService.uploadBuffer(file.buffer, {
          folder: 'parking-top/profiles',
          width: 400,
          height: 400
        });
        profileImageUrl = result.secureUrl;
      }

      // Hashear password
      const passwordHash = await bcrypt.hash(password, config.security.bcryptRounds);

      // Crear usuario
      const user = await prisma.user.create({
        data: {
          email,
          passwordHash,
          fullName,
          phone,
          role: role || 'customer',
          status: 'active',
          profileImageUrl,
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

      // Generar tokens
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

      logger.info(`User registered: ${user.id} (${user.email})`);

      sendSuccess(res, { user, token, refreshToken }, 201);
    } catch (error: any) {
      logger.error('Error registering user:', error);
      next(error);
    }
  }

  async login(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { email, password } = req.body;

      // Buscar usuario
      const user = await prisma.user.findUnique({ where: { email } });

      if (!user) {
        sendError(res, 'INVALID_CREDENTIALS', 'Credenciales incorrectas', 401);
        return;
      }

      if (user.status !== 'active') {
        sendError(res, 'ACCOUNT_SUSPENDED', 'Tu cuenta ha sido suspendida', 403);
        return;
      }

      // Verificar password
      const isValid = await bcrypt.compare(password, user.passwordHash);

      if (!isValid) {
        sendError(res, 'INVALID_CREDENTIALS', 'Credenciales incorrectas', 401);
        return;
      }

      // Actualizar último login
      await prisma.user.update({
        where: { id: user.id },
        data: { lastLoginAt: new Date() }
      });

      // Generar tokens
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

      const userResponse = {
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

      logger.info(`User logged in: ${user.id}`);

      sendSuccess(res, { user: userResponse, token, refreshToken });
    } catch (error) {
      next(error);
    }
  }

  async getMe(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;

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
        sendError(res, 'USER_NOT_FOUND', 'Usuario no encontrado', 404);
        return;
      }

      sendSuccess(res, user);
    } catch (error) {
      next(error);
    }
  }

  async refreshToken(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { refreshToken } = req.body;

      if (!refreshToken) {
        sendError(res, 'NO_TOKEN', 'Refresh token requerido', 400);
        return;
      }

      const payload = jwt.verify(refreshToken, config.jwt.refreshSecret) as { userId: string };

      const user = await prisma.user.findUnique({ where: { id: payload.userId } });

      if (!user || user.status !== 'active') {
        sendError(res, 'INVALID_TOKEN', 'Token inválido', 401);
        return;
      }

      const newToken = jwt.sign(
        { userId: user.id, email: user.email, role: user.role },
        config.jwt.secret,
        { expiresIn: config.jwt.expiresIn } as any
      );

      sendSuccess(res, { token: newToken });
    } catch (error) {
      sendError(res, 'INVALID_TOKEN', 'Token inválido o expirado', 401);
    }
  }

  async updateProfile(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const { fullName, phone } = req.body;
      const file = req.file as Express.Multer.File | undefined;

      let profileImageUrl: string | undefined;

      if (file) {
        // Eliminar imagen anterior si existe
        const user = await prisma.user.findUnique({ where: { id: userId } });

        if (user?.profileImageUrl) {
          const publicId = cloudinaryService.extractPublicId(user.profileImageUrl);
          await cloudinaryService.deleteImage(publicId).catch(() => {});
        }

        // Subir nueva imagen
        const result = await cloudinaryService.uploadBuffer(file.buffer, {
          folder: 'parking-top/profiles',
          publicId: `user-${userId}`,
          width: 400,
          height: 400
        });

        profileImageUrl = result.secureUrl;
      }

      const updated = await prisma.user.update({
        where: { id: userId },
        data: {
          ...(fullName && { fullName }),
          ...(phone && { phone }),
          ...(profileImageUrl && { profileImageUrl })
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

      sendSuccess(res, updated);
    } catch (error) {
      next(error);
    }
  }

  async changePassword(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const { currentPassword, newPassword } = req.body;

      const user = await prisma.user.findUnique({ where: { id: userId } });

      if (!user) {
        sendError(res, 'USER_NOT_FOUND', 'Usuario no encontrado', 404);
        return;
      }

      const isValid = await bcrypt.compare(currentPassword, user.passwordHash);

      if (!isValid) {
        sendError(res, 'WRONG_PASSWORD', 'Contraseña actual incorrecta', 400);
        return;
      }

      const newPasswordHash = await bcrypt.hash(newPassword, config.security.bcryptRounds);

      await prisma.user.update({
        where: { id: userId },
        data: { passwordHash: newPasswordHash }
      });

      sendSuccess(res, { message: 'Contraseña actualizada exitosamente' });
    } catch (error) {
      next(error);
    }
  }
}

export default new AuthController();
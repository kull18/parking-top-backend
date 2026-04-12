import { Request, Response, NextFunction } from 'express';
import { AuthRequest } from '@/types/interfaces';
import authService from '@/services/auth.service';
import cloudinaryService from '@/integrations/cloudinary.client';
import { sendSuccess, sendError } from '@/utils/response';
import logger from '@/utils/logger';

export class AuthController {

  async register(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { email, password, fullName, phone, role } = req.body;
      const file = req.file as Express.Multer.File | undefined;

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

      // Crear usuario a través del servicio
      const user = await authService.registerUser({
        email,
        password,
        fullName,
        phone,
        role,
        profileImageUrl
      });

      // Generar tokens
      const { token, refreshToken } = authService.generateTokens(user);

      sendSuccess(res, { user, token, refreshToken }, 201);
    } catch (error: any) {
      if (error.message === 'EMAIL_TAKEN') {
        sendError(res, 'EMAIL_TAKEN', 'El email ya está registrado', 400);
      } else {
        logger.error('Error registering user:', error);
        next(error);
      }
    }
  }

  async login(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { email, password } = req.body;

      // Login a través del servicio
      const user = await authService.loginUser(email, password);

      // Generar tokens
      const { token, refreshToken } = authService.generateTokens(user);

      sendSuccess(res, { user, token, refreshToken });
    } catch (error: any) {
      if (error.message === 'INVALID_CREDENTIALS') {
        sendError(res, 'INVALID_CREDENTIALS', 'Credenciales incorrectas', 401);
      } else if (error.message === 'ACCOUNT_SUSPENDED') {
        sendError(res, 'ACCOUNT_SUSPENDED', 'Tu cuenta ha sido suspendida', 403);
      } else {
        next(error);
      }
    }
  }

  async getMe(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;

      const user = await authService.getUserById(userId);

      sendSuccess(res, user);
    } catch (error: any) {
      if (error.message === 'USER_NOT_FOUND') {
        sendError(res, 'USER_NOT_FOUND', 'Usuario no encontrado', 404);
      } else {
        next(error);
      }
    }
  }

  async getOwnerSubscriptionStatus(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;

      const status = await authService.getOwnerSubscriptionStatus(userId);

      sendSuccess(res, status);
    } catch (error) {
      next(error);
    }
  }

  async updateProfile(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const { fullName, phone } = req.body;
      const file = req.file as Express.Multer.File | undefined;

      let profileImageUrl: string | undefined;

      if (file) {
        // Obtener usuario actual
        const currentUser = await authService.getUserById(userId);

        // Eliminar imagen anterior si existe
        if (currentUser.profileImageUrl) {
          const publicId = cloudinaryService.extractPublicId(currentUser.profileImageUrl);
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

      // Actualizar perfil a través del servicio
      const updated = await authService.updateUserProfile(userId, {
        fullName,
        phone,
        profileImageUrl
      });

      sendSuccess(res, updated);
    } catch (error) {
      next(error);
    }
  }

  async refreshToken(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { refreshToken } = req.body;

      const result = await authService.refreshUserToken(refreshToken);

      sendSuccess(res, result);
    } catch (error: any) {
      if (error.message === 'NO_TOKEN') {
        sendError(res, 'NO_TOKEN', 'Refresh token requerido', 400);
      } else {
        sendError(res, 'INVALID_TOKEN', 'Token inválido o expirado', 401);
      }
    }
  }

  async changePassword(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const { currentPassword, newPassword } = req.body;

      await authService.changeUserPassword(userId, currentPassword, newPassword);

      sendSuccess(res, { message: 'Contraseña actualizada exitosamente' });
    } catch (error: any) {
      if (error.message === 'USER_NOT_FOUND') {
        sendError(res, 'USER_NOT_FOUND', 'Usuario no encontrado', 404);
      } else if (error.message === 'WRONG_PASSWORD') {
        sendError(res, 'WRONG_PASSWORD', 'Contraseña actual incorrecta', 400);
      } else {
        next(error);
      }
    }
  }
}

export default new AuthController();
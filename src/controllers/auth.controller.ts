import { Response, NextFunction } from 'express';
import { AuthRequest } from '@/types/interfaces';
import authService from '@/services/auth.service';
import { sendSuccess, sendError } from '@/utils/response';
import logger from '@/utils/logger';

export class AuthController {
  
  async register(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { email, password, fullName, phone, role } = req.body;

      const result = await authService.register({
        email,
        password,
        fullName,
        phone,
        role
      });

      sendSuccess(res, result, 201);
    } catch (error: any) {
      logger.error('Error in register controller:', error);
      sendError(res, 'REGISTRATION_ERROR', error.message, 400);
    }
  }

  async login(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { email, password } = req.body;

      const result = await authService.login(email, password);

      sendSuccess(res, result);
    } catch (error: any) {
      logger.error('Error in login controller:', error);
      sendError(res, 'LOGIN_ERROR', error.message, 401);
    }
  }

  async refreshToken(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { refreshToken } = req.body;

      if (!refreshToken) {
        sendError(res, 'INVALID_REQUEST', 'Refresh token requerido', 400);
        return;
      }

      const result = await authService.refreshToken(refreshToken);

      sendSuccess(res, result);
    } catch (error: any) {
      sendError(res, 'REFRESH_TOKEN_ERROR', error.message, 401);
    }
  }

  async getMe(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;

      const user = await authService.getMe(userId);

      sendSuccess(res, user);
    } catch (error: any) {
      next(error);
    }
  }

  async updateProfile(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const { fullName, phone, profileImageUrl } = req.body;

      const user = await authService.updateProfile(userId, {
        fullName,
        phone,
        profileImageUrl
      });

      sendSuccess(res, user);
    } catch (error: any) {
      next(error);
    }
  }

  async changePassword(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const { currentPassword, newPassword } = req.body;

      await authService.changePassword(userId, currentPassword, newPassword);

      sendSuccess(res, { message: 'Contraseña actualizada exitosamente' });
    } catch (error: any) {
      sendError(res, 'PASSWORD_CHANGE_ERROR', error.message, 400);
    }
  }
}

export default new AuthController();
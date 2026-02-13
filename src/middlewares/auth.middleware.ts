import { Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { AuthRequest, IAuthTokenPayload } from '@/types/interfaces';
import { UserRole } from '@/types/enums';
import { config } from '@/config/environment';
import prisma from '@/config/database';
import { sendError } from '@/utils/response';

export const authenticate = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');

    if (!token) {
      sendError(res, 'UNAUTHORIZED', 'Token no proporcionado', 401);
      return;
    }

    const decoded = jwt.verify(token, config.jwt.secret) as IAuthTokenPayload;

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId }
    });

    if (!user || user.status !== 'active') {
      sendError(res, 'UNAUTHORIZED', 'Usuario no válido o inactivo', 401);
      return;
    }

    req.user = decoded;
    next();
  } catch (error) {
    sendError(res, 'UNAUTHORIZED', 'Token inválido o expirado', 401);
  }
};

export const authorize = (...roles: UserRole[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      sendError(res, 'UNAUTHORIZED', 'No autenticado', 401);
      return;
    }

    if (!roles.includes(req.user.role)) {
      sendError(res, 'FORBIDDEN', 'No tienes permisos para esta acción', 403);
      return;
    }

    next();
  };
};

export const checkActiveSubscription = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user || req.user.role !== UserRole.OWNER) {
      return next();
    }

    const subscription = await prisma.subscription.findFirst({
      where: {
        userId: req.user.userId,
        status: { in: ['active', 'trial'] }
      },
      include: { plan: true }
    });

    if (!subscription) {
      sendError(
        res,
        'NO_ACTIVE_SUBSCRIPTION',
        'Necesitas una suscripción activa para realizar esta acción',
        403
      );
      return;
    }

    (req as any).subscription = subscription;
    next();
  } catch (error) {
    next(error);
  }
};
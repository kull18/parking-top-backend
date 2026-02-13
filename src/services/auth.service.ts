import bcrypt from 'bcryptjs';
import jwt, { SignOptions } from 'jsonwebtoken';
import { config } from '@/config/environment';
import { IAuthResponse, IUserResponse, IAuthTokenPayload } from '@/types/interfaces';
import { UserRole, UserStatus } from '@/types/enums';
import logger from '@/utils/logger';
import userRepository from '@/repositories/user.repository';

export class AuthService {

  async register(data: {
    email: string;
    password: string;
    fullName: string;
    phone?: string;
    role: UserRole;
  }): Promise<IAuthResponse> {

    const existingUser = await userRepository.findByEmail(data.email);
    if (existingUser) {
      throw new Error('El email ya está registrado');
    }

    const passwordHash = await bcrypt.hash(
      data.password,
      config.security.bcryptRounds
    );

    const user = await userRepository.create({
      email: data.email,
      passwordHash,
      fullName: data.fullName,
      phone: data.phone,
      role: data.role
    });

    const token = this.generateToken(user.id, user.email, user.role as UserRole);
    const refreshToken = this.generateRefreshToken(user.id);

    logger.info(`User registered: ${user.email}`);

    return {
      user: this.formatUserResponse(user),
      token,
      refreshToken
    };
  }

  async login(email: string, password: string): Promise<IAuthResponse> {

    const user = await userRepository.findByEmail(email);
    if (!user) {
      throw new Error('Credenciales inválidas');
    }

    const isValidPassword = await bcrypt.compare(password, user.passwordHash);
    if (!isValidPassword) {
      throw new Error('Credenciales inválidas');
    }

    if (user.status !== UserStatus.ACTIVE) {
      throw new Error('Tu cuenta está inactiva o suspendida');
    }

    await userRepository.updateLastLogin(user.id);

    const token = this.generateToken(user.id, user.email, user.role as UserRole);
    const refreshToken = this.generateRefreshToken(user.id);

    logger.info(`User logged in: ${user.email}`);

    return {
      user: this.formatUserResponse(user),
      token,
      refreshToken
    };
  }

  async refreshToken(refreshToken: string) {
    const decoded = jwt.verify(
      refreshToken,
      config.jwt.refreshSecret
    ) as { userId: string };

    const user = await userRepository.findById(decoded.userId);
    if (!user || user.status !== UserStatus.ACTIVE) {
      throw new Error('Token inválido');
    }

    return {
      token: this.generateToken(user.id, user.email, user.role as UserRole),
      refreshToken: this.generateRefreshToken(user.id)
    };
  }

  async getMe(userId: string): Promise<IUserResponse> {
    const user = await userRepository.findById(userId);
    if (!user) {
      throw new Error('Usuario no encontrado');
    }
    return this.formatUserResponse(user);
  }

  async updateProfile(
    userId: string,
    data: {
      fullName?: string;
      phone?: string;
      profileImageUrl?: string;
    }
  ): Promise<IUserResponse> {

    const user = await userRepository.update(userId, data);
    return this.formatUserResponse(user);
  }

  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string
  ): Promise<void> {

    const user = await userRepository.findById(userId);
    if (!user) throw new Error('Usuario no encontrado');

    const isValid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!isValid) throw new Error('Contraseña actual incorrecta');

    const passwordHash = await bcrypt.hash(
      newPassword,
      config.security.bcryptRounds
    );

    await userRepository.update(userId, { passwordHash });

    logger.info(`Password changed for user ${userId}`);
  }

  // ================= TOKENS =================

  private generateToken(
    userId: string,
    email: string,
    role: UserRole
  ): string {

    const payload: IAuthTokenPayload = { userId, email, role };

    const options: SignOptions = {
      expiresIn: config.jwt.expiresIn
    };

    return jwt.sign(payload, config.jwt.secret, options);
  }

  private generateRefreshToken(userId: string): string {
    return jwt.sign(
      { userId },
      config.jwt.refreshSecret,
      { expiresIn: config.jwt.refreshExpiresIn }
    );
  }

  // ================= FORMAT =================

  private formatUserResponse(user: any): IUserResponse {
    return {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      phone: user.phone,
      role: user.role,
      status: user.status,
      profileImageUrl: user.profileImageUrl,
      emailVerified: user.emailVerified,
      phoneVerified: user.phoneVerified,
      createdAt: user.createdAt
    };
  }
}

export default new AuthService();

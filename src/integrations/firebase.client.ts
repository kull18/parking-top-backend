import admin from 'firebase-admin';
import { config } from '@/config/environment';
import logger from '@/utils/logger';
import prisma from '@/config/database';

if (config.firebase.projectId && config.firebase.privateKey && config.firebase.clientEmail) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: config.firebase.projectId,
      privateKey: config.firebase.privateKey,
      clientEmail: config.firebase.clientEmail
    }),
    databaseURL: config.firebase.databaseUrl
  });
} else {
  logger.warn('Firebase credentials not configured');
}

export class FirebaseService {
  
  async sendNotification(
    tokens: string[],
    notification: {
      title: string;
      body: string;
      data?: Record<string, string>;
    }
  ): Promise<void> {
    try {
      if (tokens.length === 0) return;

      const message = {
        notification: {
          title: notification.title,
          body: notification.body
        },
        data: notification.data || {},
        tokens
      };

      const response = await admin.messaging().sendEachForMulticast(message);

      logger.info(`Sent ${response.successCount} notifications, ${response.failureCount} failed`);

      const failedTokens: string[] = [];
      response.responses.forEach((resp, idx) => {
        if (!resp.success) {
          failedTokens.push(tokens[idx]);
        }
      });

      if (failedTokens.length > 0) {
        await this.removeInvalidTokens(failedTokens);
      }

    } catch (error) {
      logger.error('Error sending notification:', error);
    }
  }

  private async removeInvalidTokens(tokens: string[]): Promise<void> {
    try {
      await prisma.pushToken.updateMany({
        where: { token: { in: tokens } },
        data: { isActive: false }
      });
    } catch (error) {
      logger.error('Error removing invalid tokens:', error);
    }
  }

  async sendToUser(
    userId: string,
    notification: {
      title: string;
      body: string;
      data?: Record<string, string>;
    }
  ): Promise<void> {
    try {
      const pushTokens = await prisma.pushToken.findMany({
        where: {
          userId,
          isActive: true
        },
        select: { token: true }
      });

      if (pushTokens.length === 0) {
        logger.warn(`No active push tokens for user ${userId}`);
        return;
      }

      const tokens = pushTokens.map((pt: { token: string }) => pt.token);
      await this.sendNotification(tokens, notification);

    } catch (error) {
      logger.error('Error sending notification to user:', error);
    }
  }
}

export default new FirebaseService();
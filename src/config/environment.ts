import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '../../.env') });
type JwtExpiresIn = number | `${number}${'s' | 'm' | 'h' | 'd'}`;

export const config = {
  app: {
    env: process.env.NODE_ENV || 'development',
    port: parseInt(process.env.PORT || '3000', 10),
    apiVersion: process.env.API_VERSION || 'v1',
    name: process.env.APP_NAME || 'Parking Top',
    apiUrl: process.env.API_URL || 'http://localhost:3000'
  },

  database: {
    url: process.env.DATABASE_URL || ''
  },

  redis: {
    url: process.env.REDIS_URL || 'redis://localhost:6379',
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD || undefined,
    ttl: parseInt(process.env.REDIS_TTL || '300', 10)
  },

  jwt: {
    secret: process.env.JWT_SECRET as string,
    refreshSecret: process.env.JWT_REFRESH_SECRET as string,
    expiresIn: process.env.JWT_EXPIRES_IN as JwtExpiresIn,
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN as JwtExpiresIn
  },

  stripe: {
    secretKey: process.env.STRIPE_SECRET_KEY || '',
    publishableKey: process.env.STRIPE_PUBLISHABLE_KEY || '',
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET || '',
    currency: process.env.STRIPE_CURRENCY || 'mxn'
  },

  mercadopago: {
    accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN || '',
    publicKey: process.env.MERCADOPAGO_PUBLIC_KEY || '',
    webhookSecret: process.env.MERCADOPAGO_WEBHOOK_SECRET ?? ''
  },

  firebase: {
    projectId: process.env.FCM_PROJECT_ID || '',
    privateKey: process.env.FCM_PRIVATE_KEY?.replace(/\\n/g, '\n') || '',
    clientEmail: process.env.FCM_CLIENT_EMAIL || '',
    databaseUrl: process.env.FCM_DATABASE_URL || ''
  },

cloudinary: {
  cloudName: process.env.CLOUDINARY_CLOUD_NAME || '',
  apiKey: process.env.CLOUDINARY_API_KEY || '',
  apiSecret: process.env.CLOUDINARY_API_SECRET || ''
},
  maps: {
    googleApiKey: process.env.GOOGLE_MAPS_API_KEY || '',
    mapboxToken: process.env.MAPBOX_TOKEN || '',
    preferredProvider: (process.env.MAPS_PROVIDER || 'google') as 'google' | 'mapbox'
  },

  frontend: {
    url: process.env.FRONTEND_URL || 'http://localhost:3001',
    allowedOrigins: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000']
  },

  business: {
    defaultCommissionRate: parseFloat(process.env.DEFAULT_COMMISSION_RATE || '15'),
    overtimeGracePeriodMinutes: parseInt(process.env.OVERTIME_GRACE_PERIOD_MINUTES || '15', 10),
    overtimeAutoReleaseHours: parseInt(process.env.OVERTIME_AUTO_RELEASE_HOURS || '6', 10),
    notificationBeforeEndMinutes: parseInt(process.env.NOTIFICATION_BEFORE_END_MINUTES || '30', 10),
    minReservationDurationMinutes: parseInt(process.env.MIN_RESERVATION_DURATION_MINUTES || '30', 10),
    maxReservationDurationDays: parseInt(process.env.MAX_RESERVATION_DURATION_DAYS || '7', 10),
    subscriptionGracePeriodDays: parseInt(process.env.SUBSCRIPTION_GRACE_PERIOD_DAYS || '3', 10),
    subscriptionReminderDaysBefore: parseInt(process.env.SUBSCRIPTION_REMINDER_DAYS_BEFORE || '7', 10)
  },

  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000', 10),
    maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100', 10)
  },

  logging: {
    level: process.env.LOG_LEVEL || 'info',
    format: process.env.LOG_FORMAT || 'json'
  },

  security: {
    bcryptRounds: parseInt(process.env.BCRYPT_ROUNDS || '10', 10)
  }
};

export function validateConfig(): void {
  const required = ['DATABASE_URL', 'JWT_SECRET', 'JWT_REFRESH_SECRET'];
  const missing = required.filter(key => !process.env[key]);

  if (missing.length > 0) {
    throw new Error(`Missing required env vars: ${missing.join(', ')}`);
  }
}

export default config;

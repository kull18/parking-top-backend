// src/utils/logger.ts
import winston from 'winston';
import { config } from '@/config/environment';

// Helper para serializar errores con referencias circulares de forma segura
const safeStringify = (obj: any): string => {
  const seen = new WeakSet();
  
  return JSON.stringify(obj, (key, value) => {
    // Manejar objetos con referencias circulares
    if (typeof value === 'object' && value !== null) {
      if (seen.has(value)) {
        return '[Circular]';
      }
      seen.add(value);
    }
    
    // Limpiar propiedades de axios que causan problemas
    if (key === 'request' || key === 'response' || key === 'config') {
      if (value && typeof value === 'object') {
        return {
          ...(value.status && { status: value.status }),
          ...(value.statusText && { statusText: value.statusText }),
          ...(value.data && { data: value.data }),
          ...(value.message && { message: value.message })
        };
      }
    }
    
    return value;
  }, 2);
};

const logger = winston.createLogger({
  level: config.logging.level,
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    config.logging.format === 'json'
      ? winston.format.json()
      : winston.format.simple()
  ),
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.printf(({ timestamp, level, message, ...meta }) => {
          try {
            const metaStr = Object.keys(meta).length ? safeStringify(meta) : '';
            return `${timestamp} [${level}]: ${message} ${metaStr}`;
          } catch (error) {
            // Fallback si aún así falla
            return `${timestamp} [${level}]: ${message} [Error serializing metadata]`;
          }
        })
      )
    })
  ]
});

if (config.app.env === 'production') {
  logger.add(
    new winston.transports.File({
      filename: 'logs/error.log',
      level: 'error'
    })
  );
  logger.add(
    new winston.transports.File({
      filename: 'logs/combined.log'
    })
  );
}

export default logger;
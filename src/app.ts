import express, { Application } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import { config } from '@/config/environment';
import { errorHandler, notFound } from '@/middlewares/error.middleware';
import { generalLimiter } from '@/middlewares/rate-limit.middleware';
import routes from '@/routes';
import mercadopagoWebhook from '@/webhooks/mercadopago.webhook';

const app: Application = express();

app.set('trust proxy', 1); // Si estás detrás de un proxy (ej. Heroku) para obtener IP real en rate limiting y logs

app.use(helmet());
app.use(cors({
  origin: config.frontend.allowedOrigins,
  credentials: true
}));

app.use(generalLimiter);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(compression());

if (config.app.env === 'development') {
  app.use(morgan('dev'));
}

app.get('/health', (_, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    environment: config.app.env,
    version: '1.0.0'
  });
});
app.use('/webhooks/mercadopago', mercadopagoWebhook);
app.use(`/${config.app.apiVersion}`, routes);

app.use(notFound);
app.use(errorHandler);

export default app;
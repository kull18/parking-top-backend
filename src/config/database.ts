import { PrismaClient } from '@prisma/client';
import { config } from './environment';

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: config.database.url
    }
  },
  log: config.app.env === 'development' ? ['query', 'error', 'warn'] : ['error']
});

process.on('beforeExit', async () => {
  await prisma.$disconnect();
});

export default prisma;
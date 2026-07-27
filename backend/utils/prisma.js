import { PrismaClient } from '@prisma/client';

// Single shared Prisma instance — prevents connection pool exhaustion
const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  datasources: {
    db: {
      url: process.env.DATABASE_URL,
    },
  },
});

export default prisma;

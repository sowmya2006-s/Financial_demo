// src/config/prisma.ts
// Single shared Prisma client instance.
// Prisma recommends only one instance per process to avoid connection pool exhaustion.

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  log: process.env['NODE_ENV'] === 'development' ? ['query', 'warn', 'error'] : ['error'],
});

export default prisma;

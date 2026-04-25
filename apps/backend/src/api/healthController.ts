// src/api/healthController.ts
// Simple health-check endpoint. Used by deployment tools and frontend to confirm
// the backend is alive before making game API calls.

import { Router, Request, Response } from 'express';
import prisma from '../config/prisma';

const router = Router();

/**
 * GET /health
 * Returns server status and a database connectivity check.
 */
router.get('/', async (_req: Request, res: Response) => {
  try {
    // Lightweight DB ping — confirms Prisma connection is healthy
    await prisma.$queryRaw`SELECT 1`;
    res.status(200).json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      database: 'connected',
    });
  } catch {
    res.status(503).json({
      status: 'degraded',
      timestamp: new Date().toISOString(),
      database: 'disconnected',
    });
  }
});

export default router;

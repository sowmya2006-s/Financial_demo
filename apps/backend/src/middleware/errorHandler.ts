// src/middleware/errorHandler.ts
// Global error handler — catches any error thrown from route handlers or services.
// Ensures consistent { error, code } response shape across the entire API.

import { Request, Response, NextFunction } from 'express';

export class AppError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({ error: err.message, code: err.code });
    return;
  }

  // Unexpected error — log it, return generic 500
  console.error('[Unhandled Error]', err);
  res.status(500).json({ error: 'Internal server error', code: 'INTERNAL_ERROR' });
}

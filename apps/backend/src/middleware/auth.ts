// src/middleware/auth.ts
// Verifies the JWT on every protected route.
// On success, attaches the decoded payload to req.user.
// On failure, returns 401 immediately — the route handler never runs.

import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { AuthPayload } from '../types';

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  console.log('Auth Header:', authHeader);

  if (req.method === 'OPTIONS') { next(); return; }
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing or malformed Authorization header', code: 'AUTH_MISSING' });
    return;
  }

  const token = authHeader.slice(7); // strip "Bearer "

  try {
    const payload = jwt.verify(token, env.jwtSecret) as AuthPayload;
    req.user = payload;
    next();
  } catch (err) {
    console.error('JWT verification error:', err);
    res.status(401).json({ error: 'Invalid or expired token', code: 'AUTH_INVALID' });
  }
}

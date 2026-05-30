// src/api/authController.ts
// RULE: Controllers only validate request shape and delegate to services.
// NO business logic here. NO database calls here.

import { Router, Request, Response, NextFunction } from 'express';
import { authService } from '../services/authService';
import { requireAuth } from '../middleware/auth';

const router = Router();

/**
 * POST /auth/register
 * Creates a new user account.
 */
router.post('/register', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, name, password } = req.body;

    // Basic presence check only — deep validation is the service's job
    if (!email || !name || !password) {
      res.status(400).json({ error: 'email, name, and password are required', code: 'MISSING_FIELDS' });
      return;
    }

// Register new user and then log them in to get a JWT
    const newUser = await authService.register({ email, name, password });
    const loginResult = await authService.login({ email, password });
    res.status(201).json({ token: loginResult.token, user: newUser });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /auth/login
 * Authenticates a user and returns a JWT.
 */
router.post('/login', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400).json({ error: 'email and password are required', code: 'MISSING_FIELDS' });
      return;
    }

    const result = await authService.login({ email, password });
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /auth/google
 * Authenticates a user using Google (Auto-creates account if not exists).
 * Body: { email: string, name: string }
 */
router.post('/google', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, name } = req.body;

    if (!email || !name) {
      res.status(400).json({ error: 'email and name are required', code: 'MISSING_FIELDS' });
      return;
    }

    const result = await authService.googleLogin({ email, name });
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /auth/logout
 * Stateless JWT — logout is handled client-side by discarding the token.
 * This endpoint exists for API completeness and future token-revocation support.
 */
router.post('/logout', requireAuth, (_req: Request, res: Response) => {
  res.status(200).json({ success: true });
});

export default router;

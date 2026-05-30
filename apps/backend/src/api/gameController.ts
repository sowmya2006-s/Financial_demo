// src/api/gameController.ts
// Handles API requests for game state, weekly decisions, advances, and logs.

import { Router, Request, Response, NextFunction } from 'express';
import { requireAuth } from '../middleware/auth';
import { gameService } from '../services/gameService';

const router = Router();

// Require authorization for all game operations
router.use(requireAuth);

/**
 * GET /game/:profileId/state
 * Returns profile info, metrics, balance, and net worth.
 */
router.get('/:profileId/state', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { profileId } = req.params;
    const state = await gameService.getGameState(req.user!.userId, profileId!);
    res.status(200).json(state);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /game/:profileId/decisions
 * Submits player decisions for the week.
 * Body: { decisions: Array<{ type, category, amount, metadata }> }
 */
router.post('/:profileId/decisions', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { profileId } = req.params;
    const { decisions } = req.body;

    if (!Array.isArray(decisions)) {
      res.status(400).json({ error: 'decisions must be an array', code: 'VALIDATION_ERROR' });
      return;
    }

    const result = await gameService.submitDecisions(req.user!.userId, profileId!, decisions);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /game/:profileId/advance-week
 * Advances the simulation by one week (atomic weekly tick).
 */
router.post('/:profileId/advance-week', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { profileId } = req.params;
    const result = await gameService.advanceWeek(req.user!.userId, profileId!);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /game/:profileId/history
 * Returns the player's transactional history and weekly summaries list.
 */
router.get('/:profileId/history', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { profileId } = req.params;
    const result = await gameService.getHistory(req.user!.userId, profileId!);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /game/:profileId/summary/:week
 * Returns details for a specific weekly summary.
 */
router.get('/:profileId/summary/:week', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { profileId, week } = req.params;
    const parsedWeek = parseInt(week!, 10);
    if (isNaN(parsedWeek)) {
      res.status(400).json({ error: 'week must be an integer', code: 'VALIDATION_ERROR' });
      return;
    }

    const result = await gameService.getWeeklySummary(req.user!.userId, profileId!, parsedWeek);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
});

export default router;

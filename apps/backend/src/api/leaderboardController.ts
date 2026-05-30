// src/api/leaderboardController.ts
// Handles API requests for cohort leaderboards.

import { Router, Request, Response, NextFunction } from 'express';
import { requireAuth } from '../middleware/auth';
import { leaderboardService } from '../services/leaderboardService';

const router = Router();

// Require authorization for all cohort standings operations
router.use(requireAuth);

/**
 * GET /cohorts/:cohortId/leaderboard
 * Returns a list of ranked players in the cohort, sorted by net worth.
 */
router.get('/:cohortId/leaderboard', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { cohortId } = req.params;
    const rankings = await leaderboardService.getCohortLeaderboard(req.user!.userId, cohortId!);
    res.status(200).json({ rankings });
  } catch (err) {
    next(err);
  }
});

export default router;

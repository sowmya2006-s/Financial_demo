// src/api/profileController.ts
// RULE: Controllers only validate request shape and delegate to services.
// NO business logic here. NO database calls here.

import { Router, Request, Response, NextFunction } from 'express';
import { requireAuth } from '../middleware/auth';
import { profileService } from '../services/profileService';

const router = Router();

// All profile routes require authentication
router.use(requireAuth);


/**
 * POST /profiles
 * Creates a new game profile for the authenticated user.
 * Body: { name: string, difficulty: 'BEGINNER' | 'STANDARD' | 'HARD' }
 */
router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, difficulty, age } = req.body;


    if (!name || !difficulty) {
      res.status(400).json({ error: 'name and difficulty are required', code: 'MISSING_FIELDS' });
      return;
    }

    const profile = await profileService.createProfile(req.user!.userId, { name, difficulty, age });
    // Build response payload including new fields
    const responsePayload = {
      id: profile.id,
      name: profile.name,
      difficulty: profile.difficulty,
      cohortId: profile.cohortId,
      age: profile.age,
      career: profile.career,
      startingSalary: profile.startingSalary,
      startingSavings: profile.startingSavings,
      createdAt: profile.createdAt,
    };
    res.status(201).json({ profile: responsePayload });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /profiles
 * Lists all profiles belonging to the authenticated user.
 */
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const profiles = await profileService.listProfiles(req.user!.userId);
    res.status(200).json({ profiles });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /profiles/:id
 * Fetches a single profile (must belong to the authenticated user).
 */
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const profile = await profileService.getProfile(req.user!.userId, req.params['id']!);
    res.status(200).json({ profile });
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /profiles/:id
 * Deletes a profile.
 */
router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    await profileService.deleteProfile(req.user!.userId, req.params['id']!);
    res.status(200).json({ success: true });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /profiles/:id/living-option
 * Sets the living option for a newly created profile before week 1 starts.
 */
router.post('/:id/living-option', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { livingOption } = req.body;
    if (!['INDIVIDUAL_RENT', 'SHARED_RENT', 'HOME_LOAN'].includes(livingOption)) {
      res.status(400).json({ error: 'Invalid living option', code: 'VALIDATION_ERROR' });
      return;
    }

    const { housingService } = await import('../services/housingService');
    const updatedProfile = await housingService.setLivingOption(req.params['id']!, livingOption);
    res.status(200).json({ profile: updatedProfile });
  } catch (err) {
    next(err);
  }
});

export default router;

// src/services/profileService.ts
// All profile and cohort business logic lives here.
// Enforces: profile limits per difficulty, cohort assignment, profile ownership checks.

import { Profile } from '@prisma/client';
import { Difficulty } from '../types/enums';
import { profileRepository } from '../repositories/profileRepository';
import { cohortRepository } from '../repositories/cohortRepository';
import { canCreateProfile, isValidDifficulty, isValidProfileName } from '../domain/profile';
import { getISOWeekKey } from '../domain/cohort';
import { AppError } from '../middleware/errorHandler';
import { CreateProfileInput, ProfileResponse } from '../types';
import { GAME_CONSTANTS } from '../config/constants';
import prisma from '../config/prisma';

export const profileService = {
  /**
   * Creates a new profile for the authenticated user.
   *
   * Steps:
   * 1. Validate input
   * 2. Enforce per-difficulty profile limit
   * 3. Find or create cohort for the current calendar week
   * 4. Create profile (and initialise game state in a single transaction)
   */
  async createProfile(userId: string, input: CreateProfileInput): Promise<ProfileResponse> {
    // 1. Validate input
    if (!isValidProfileName(input.name)) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Profile name must be between 1 and 50 characters');
    }
    if (!isValidDifficulty(input.difficulty)) {
      throw new AppError(400, 'VALIDATION_ERROR', `Invalid difficulty. Must be one of: BEGINNER, STANDARD, HARD`);
    }

    // 2. Enforce profile limits
    const existingCount = await profileRepository.countByUserAndDifficulty(userId, input.difficulty);
    if (!canCreateProfile(input.difficulty, existingCount)) {
      const limits: Record<Difficulty, number> = { BEGINNER: 5, STANDARD: 1, HARD: 1 };
      throw new AppError(
        409,
        'PROFILE_LIMIT_REACHED',
        `You can only have ${limits[input.difficulty]} profile(s) at ${input.difficulty} difficulty`,
      );
    }

    // 3. Find or create cohort for this calendar week
    const weekKey = getISOWeekKey(new Date());
    const cohort = await cohortRepository.findOrCreate(weekKey);

    // 4. Create profile + initialise game state atomically
    // This ensures a profile is never created without a corresponding game state
    const profile = await prisma.$transaction(async tx => {
      const newProfile = await tx.profile.create({
        data: {
          userId,
          cohortId: cohort.id,
          name: input.name.trim(),
          difficulty: input.difficulty,
        },
      });

      // Seed default obligations
      await tx.obligation.createMany({
        data: GAME_CONSTANTS.DEFAULT_OBLIGATIONS.map(o => ({
          profileId: newProfile.id,
          label: o.label,
          category: o.category,
          amount: o.amount,
        })),
      });

      // Initialise game state at week 1
      await tx.gameState.create({
        data: {
          profileId: newProfile.id,
          currentWeek: 1,
          salary: GAME_CONSTANTS.STARTING_SALARY_PAISE,
          creditScore: GAME_CONSTANTS.DEFAULT_CREDIT_SCORE,
          socialScore: GAME_CONSTANTS.DEFAULT_SOCIAL_SCORE,
          wellBeing: GAME_CONSTANTS.DEFAULT_WELL_BEING,
          status: 'ACTIVE',
        },
      });

      return newProfile;
    });

    return {
      id: profile.id,
      name: profile.name,
      difficulty: profile.difficulty as Difficulty,
      cohortId: profile.cohortId,
      createdAt: profile.createdAt,
    };
  },

  /**
   * Lists all profiles belonging to the authenticated user.
   */
  async listProfiles(userId: string): Promise<Profile[]> {
    return profileRepository.findByUserId(userId);
  },

  /**
   * Fetches a single profile, verifying it belongs to the requesting user.
   */
  async getProfile(userId: string, profileId: string): Promise<Profile> {
    const profile = await profileRepository.findById(profileId);

    if (!profile) {
      throw new AppError(404, 'PROFILE_NOT_FOUND', 'Profile not found');
    }
    if (profile.userId !== userId) {
      // Return 404 rather than 403 to avoid leaking existence of other users' profiles
      throw new AppError(404, 'PROFILE_NOT_FOUND', 'Profile not found');
    }

    return profile;
  },

  /**
   * Deletes a profile, verifying ownership.
   */
  async deleteProfile(userId: string, profileId: string): Promise<void> {
    const profile = await profileRepository.findById(profileId);

    if (!profile) {
      throw new AppError(404, 'PROFILE_NOT_FOUND', 'Profile not found');
    }
    if (profile.userId !== userId) {
      throw new AppError(403, 'FORBIDDEN', 'You do not own this profile');
    }

    await profileRepository.delete(profileId);
  },
};

// src/services/profileService.ts
// All profile and cohort business logic lives here.
// Enforces: profile limits per difficulty, cohort assignment, profile ownership checks.

import prisma from '../config/prisma';
import { AppError } from '../middleware/errorHandler';
import { GAME_CONSTANTS } from '../config/constants';
import { Difficulty } from '../types/enums';
import {
  isValidProfileName,
  isValidDifficulty,
  canCreateProfile,
  generateCareer,
  calculateStartingSalary,
  calculateStartingSavings,
  calculateWeeksUntilRetirement,
} from '../domain/profile';
import { profileRepository } from '../repositories/profileRepository';
import { cohortRepository } from '../repositories/cohortRepository';
import { Profile } from '@prisma/client';
import { getISOWeekKey } from '../domain/cohort';

export interface CreateProfileInput {
  name: string;
  difficulty: Difficulty;
  age: number;
}

export interface ProfileResponse {
  id: string;
  name: string;
  difficulty: string;
  cohortId: string;
  cohortWeekKey: string;
  age: number;
  startingAge: number;
  career: string;
  startingSalary: number;
  startingSavings: number;
  weeksUntilRetirement: number;
  createdAt: Date;
}

export const profileService = {
  /**
   * Creates a new profile for the authenticated user.
   *
   * Steps:
   * 1. Validate input
   * 2. Enforce per-difficulty profile limit
   * 3. Find or create cohort for the current calendar week
   * 4. Create profile (and initialise game state in a single transaction)
   *
   * Beginner Rule: All Beginner profiles start with identical conditions:
   *   - salary: ₹45,000 (BEGINNER_STARTING_SALARY_PAISE)
   *   - savings: ₹15,000 (BEGINNER_STARTING_SAVINGS_PAISE)
   *   - career: Junior Developer
   *   - creditScore: 650, socialScore: 20, wellBeing: 50
   */
  async createProfile(userId: string, input: CreateProfileInput): Promise<ProfileResponse> {
    // 1. Validate input
    if (!isValidProfileName(input.name)) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Profile name must be between 1 and 50 characters');
    }
    if (!isValidDifficulty(input.difficulty)) {
      throw new AppError(400, 'VALIDATION_ERROR', `Invalid difficulty. Must be one of: BEGINNER, STANDARD, HARD`);
    }

    const age = (input.age && input.age >= 18 && input.age <= 40) ? input.age : 22;

    // Beginner profiles are always pinned to age 22 for fair comparison
    const effectiveAge = input.difficulty === 'BEGINNER' ? GAME_CONSTANTS.BEGINNER_STARTING_AGE : age;

    // 2. Enforce profile limits
    const existingCount = await profileRepository.countByUserAndDifficulty(userId, input.difficulty);
    if (!canCreateProfile(input.difficulty, existingCount)) {
      const limits: Record<Difficulty, number> = {
        BEGINNER: GAME_CONSTANTS.MAX_PROFILES_PER_DIFFICULTY.BEGINNER,
        STANDARD: GAME_CONSTANTS.MAX_PROFILES_PER_DIFFICULTY.STANDARD,
        HARD: GAME_CONSTANTS.MAX_PROFILES_PER_DIFFICULTY.HARD,
      };
      throw new AppError(
        409,
        'PROFILE_LIMIT_REACHED',
        `You can only have ${limits[input.difficulty]} profile(s) at ${input.difficulty} difficulty`,
      );
    }

    // 3. Find or create cohort for this calendar week
    const weekKey = getISOWeekKey(new Date());
    const cohort = await cohortRepository.findOrCreate(weekKey);

    // Generate player attributes
    const career        = generateCareer(input.difficulty, effectiveAge);
    const startingSalary = calculateStartingSalary(input.difficulty, effectiveAge);
    const startingSavings = calculateStartingSavings(input.difficulty, startingSalary);

    // 4. Create profile + initialise game state atomically
    const profile = await prisma.$transaction(async tx => {
      const newProfile = await tx.profile.create({
        data: {
          userId,
          cohortId: cohort.id,
          name: input.name.trim(),
          difficulty: input.difficulty,
          age: effectiveAge,
          startingAge: effectiveAge,
          career,
          startingSalary,
          startingSavings,
          active: true,
        },
      });

      // Opening savings credit (appears as week 0 / initial balance)
      await tx.transaction.create({
        data: {
          profileId: newProfile.id,
          type: 'CREDIT',
          category: 'savings',
          amount: startingSavings,
          gameWeek: 0,
          description: 'Starting Savings',
        },
      });

      // Initialise game state with spec-correct default values
      await tx.gameState.create({
        data: {
          profileId: newProfile.id,
          currentWeek: 1,
          salary: startingSalary,
          creditScore: GAME_CONSTANTS.DEFAULT_CREDIT_SCORE,   // 650
          socialScore: GAME_CONSTANTS.DEFAULT_SOCIAL_SCORE,   // 20
          wellBeing:   GAME_CONSTANTS.DEFAULT_WELL_BEING,     // 50
          missedPayments: 0,
          status: 'ACTIVE',
        },
      });

      return newProfile;
    });

    const cohortWithData = await prisma.cohort.findUnique({ where: { id: cohort.id } });

    return {
      id: profile.id,
      name: profile.name,
      difficulty: profile.difficulty as Difficulty,
      cohortId: profile.cohortId,
      cohortWeekKey: cohortWithData?.weekKey ?? weekKey,
      age: profile.age,
      startingAge: profile.startingAge,
      career: profile.career,
      startingSalary: profile.startingSalary,
      startingSavings: profile.startingSavings,
      weeksUntilRetirement: calculateWeeksUntilRetirement(profile.age),
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

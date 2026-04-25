// src/domain/profile.ts
// Pure functions for profile-related business rules.
// NO database access. NO side effects. Fully deterministic and unit-testable.

import { Difficulty } from '../types/enums';
import { MAX_PROFILES_PER_DIFFICULTY } from '../config/constants';

/**
 * Checks whether a user is allowed to create another profile of the given difficulty,
 * given how many they already have.
 */
export function canCreateProfile(difficulty: Difficulty, existingCount: number): boolean {
  const limit = MAX_PROFILES_PER_DIFFICULTY[difficulty];
  return existingCount < limit;
}

/**
 * Returns the maximum number of profiles allowed for a given difficulty.
 */
export function maxProfilesForDifficulty(difficulty: Difficulty): number {
  return MAX_PROFILES_PER_DIFFICULTY[difficulty];
}

/**
 * Validates a profile display name.
 */
export function isValidProfileName(name: string): boolean {
  const trimmed = name.trim();
  return trimmed.length >= 1 && trimmed.length <= 50;
}

/**
 * Checks if a difficulty string is a valid Difficulty enum value.
 */
export function isValidDifficulty(value: string): value is Difficulty {
  return Object.values(Difficulty).includes(value as Difficulty);
}

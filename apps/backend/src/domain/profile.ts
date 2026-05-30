// src/domain/profile.ts
// Pure functions for profile-related business rules.
// NO database access. NO side effects. Fully deterministic and unit-testable.

import { Difficulty } from '../types/enums';
import { GAME_CONSTANTS } from '../config/constants';

/**
 * Checks whether a user is allowed to create another profile of the given difficulty,
 * given how many they already have.
 */
export function canCreateProfile(difficulty: Difficulty, existingCount: number): boolean {
  const limit = GAME_CONSTANTS.MAX_PROFILES_PER_DIFFICULTY[difficulty];
  return existingCount < limit;
}

/**
 * Returns the maximum number of profiles allowed for a given difficulty.
 */
export function maxProfilesForDifficulty(difficulty: Difficulty): number {
  return GAME_CONSTANTS.MAX_PROFILES_PER_DIFFICULTY[difficulty];
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

/**
 * Returns a starting career title based on difficulty.
 * Beginner mode always uses a fixed career regardless of age (identical starts).
 */
export function generateCareer(difficulty: Difficulty, age: number): string {
  if (difficulty === 'BEGINNER') {
    // All Beginner profiles get same starting career (identical conditions)
    return 'Junior Developer';
  }

  const careersByDifficulty: Record<Difficulty, string[]> = {
    BEGINNER: ['Junior Developer'],
    STANDARD: ['Developer', 'Data Analyst', 'Marketing Associate', 'Accountant', 'Junior Designer'],
    HARD:     ['Senior Developer', 'Senior Analyst', 'Engineering Manager', 'Finance Manager'],
  };
  const options = careersByDifficulty[difficulty];
  // Deterministic selection based on age modulo length
  return options[age % options.length]!;
}

/**
 * Returns a starting salary (in paise) based on difficulty and age.
 *
 * BEGINNER: All profiles start with an identical ₹45,000 salary regardless of age.
 *           This is mandatory for fair parallel profile comparison.
 * STANDARD: Age-scaled from ₹50,000 base.
 * HARD:     Age-scaled from ₹80,000 base with no catch-up bonus.
 */
export function calculateStartingSalary(difficulty: Difficulty, age: number): number {
  if (difficulty === 'BEGINNER') {
    // Pinned — identical for all Beginner profiles (spec requirement)
    return GAME_CONSTANTS.BEGINNER_STARTING_SALARY_PAISE;
  }

  if (difficulty === 'STANDARD') {
    const ageIncrement = Math.max(0, age - 22) * 50_000; // ₹500 per year above 22
    return GAME_CONSTANTS.STANDARD_BASE_SALARY_PAISE + ageIncrement;
  }

  // HARD
  const ageIncrement = Math.max(0, age - 22) * 100_000; // ₹1,000 per year above 22
  return GAME_CONSTANTS.HARD_BASE_SALARY_PAISE + ageIncrement;
}

/**
 * Returns starting savings (in paise).
 *
 * BEGINNER: Pinned at ₹15,000 (identical starts requirement).
 * Others:   33% of first month's salary.
 */
export function calculateStartingSavings(difficulty: Difficulty, startingSalary: number): number {
  if (difficulty === 'BEGINNER') {
    return GAME_CONSTANTS.BEGINNER_STARTING_SAVINGS_PAISE;
  }
  return Math.floor(startingSalary * 0.33);
}

/**
 * Calculates how many weeks remain until retirement at age 60.
 * Formula: (60 - currentAge) * 52
 */
export function calculateWeeksUntilRetirement(currentAge: number): number {
  const remainingYears = Math.max(0, GAME_CONSTANTS.RETIREMENT_AGE - currentAge);
  return remainingYears * 52;
}

/**
 * Returns true if the player has reached retirement age based on weeks played.
 * startingAge is locked at profile creation.
 * retirementWeek = (RETIREMENT_AGE - startingAge) * 52
 */
export function hasReachedRetirement(currentWeek: number, startingAge: number): boolean {
  const retirementWeek = (GAME_CONSTANTS.RETIREMENT_AGE - startingAge) * 52;
  return currentWeek >= retirementWeek;
}

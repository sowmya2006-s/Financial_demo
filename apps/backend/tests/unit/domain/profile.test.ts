// tests/unit/domain/profile.test.ts
// Tests for pure profile domain functions.
// No mocks needed — these are pure functions with no dependencies.

import { Difficulty } from '@prisma/client';
import {
  canCreateProfile,
  isValidDifficulty,
  isValidProfileName,
  maxProfilesForDifficulty,
} from '../../../src/domain/profile';

describe('canCreateProfile', () => {
  describe('BEGINNER difficulty', () => {
    it('allows creation when under the limit', () => {
      expect(canCreateProfile(Difficulty.BEGINNER, 0)).toBe(true);
      expect(canCreateProfile(Difficulty.BEGINNER, 4)).toBe(true);
    });

    it('blocks creation at the limit', () => {
      expect(canCreateProfile(Difficulty.BEGINNER, 5)).toBe(false);
      expect(canCreateProfile(Difficulty.BEGINNER, 10)).toBe(false);
    });
  });

  describe('STANDARD difficulty', () => {
    it('allows creation when user has zero profiles', () => {
      expect(canCreateProfile(Difficulty.STANDARD, 0)).toBe(true);
    });

    it('blocks creation when user already has one profile', () => {
      expect(canCreateProfile(Difficulty.STANDARD, 1)).toBe(false);
    });
  });

  describe('HARD difficulty', () => {
    it('allows creation when user has zero profiles', () => {
      expect(canCreateProfile(Difficulty.HARD, 0)).toBe(true);
    });

    it('blocks creation when user already has one profile', () => {
      expect(canCreateProfile(Difficulty.HARD, 1)).toBe(false);
    });
  });
});

describe('maxProfilesForDifficulty', () => {
  it('returns 5 for BEGINNER', () => {
    expect(maxProfilesForDifficulty(Difficulty.BEGINNER)).toBe(5);
  });

  it('returns 1 for STANDARD', () => {
    expect(maxProfilesForDifficulty(Difficulty.STANDARD)).toBe(1);
  });

  it('returns 1 for HARD', () => {
    expect(maxProfilesForDifficulty(Difficulty.HARD)).toBe(1);
  });
});

describe('isValidProfileName', () => {
  it('accepts valid names', () => {
    expect(isValidProfileName('My Profile')).toBe(true);
    expect(isValidProfileName('A')).toBe(true);
    expect(isValidProfileName('A'.repeat(50))).toBe(true);
  });

  it('rejects empty names', () => {
    expect(isValidProfileName('')).toBe(false);
    expect(isValidProfileName('   ')).toBe(false); // whitespace only
  });

  it('rejects names over 50 characters', () => {
    expect(isValidProfileName('A'.repeat(51))).toBe(false);
  });
});

describe('isValidDifficulty', () => {
  it('returns true for valid difficulty values', () => {
    expect(isValidDifficulty('BEGINNER')).toBe(true);
    expect(isValidDifficulty('STANDARD')).toBe(true);
    expect(isValidDifficulty('HARD')).toBe(true);
  });

  it('returns false for invalid difficulty values', () => {
    expect(isValidDifficulty('EASY')).toBe(false);
    expect(isValidDifficulty('beginner')).toBe(false); // case-sensitive
    expect(isValidDifficulty('')).toBe(false);
    expect(isValidDifficulty('EXPERT')).toBe(false);
  });
});

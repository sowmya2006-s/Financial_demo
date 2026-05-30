// tests/unit/domain/game.test.ts
// Unit tests for the pure game simulation functions.

import {
  calculateNetWorth,
  clampCreditScore,
  clampSocialScore,
  clampWellBeing,
  checkBankruptcy,
  checkRetirement,
  selectEvents,
} from '../../../src/domain/game';
import { Difficulty } from '../../../src/types/enums';

describe('Game Domain Logic', () => {
  describe('calculateNetWorth', () => {
    it('should correctly sum liquid balance and investments value', () => {
      expect(calculateNetWorth(1000, 500)).toBe(1500);
      expect(calculateNetWorth(-200, 500)).toBe(300);
      expect(calculateNetWorth(0, 0)).toBe(0);
    });
  });

  describe('Clamping Functions', () => {
    it('should clamp credit score between 300 and 900', () => {
      expect(clampCreditScore(250)).toBe(300);
      expect(clampCreditScore(950)).toBe(900);
      expect(clampCreditScore(700)).toBe(700);
    });

    it('should clamp social score between 0 and 100', () => {
      expect(clampSocialScore(-10)).toBe(0);
      expect(clampSocialScore(110)).toBe(100);
      expect(clampSocialScore(50)).toBe(50);
    });

    it('should clamp well-being between 0 and 100', () => {
      expect(clampWellBeing(-5)).toBe(0);
      expect(clampWellBeing(105)).toBe(100);
      expect(clampWellBeing(75)).toBe(75);
    });
  });

  describe('Bankruptcy and Retirement Checks', () => {
    it('should trigger bankruptcy only if net worth is negative AND balance cannot cover weekly bills', () => {
      // Case 1: Positive net worth, positive balance
      expect(checkBankruptcy(1000, 500, 100)).toBe(false);
      // Case 2: Negative net worth, but positive balance enough to cover bills
      expect(checkBankruptcy(-100, 500, 100)).toBe(false);
      // Case 3: Negative net worth, positive balance but NOT enough to cover bills
      expect(checkBankruptcy(-500, 50, 100)).toBe(true);
      // Case 4: Negative net worth, negative balance
      expect(checkBankruptcy(-500, -50, 100)).toBe(true);
    });

    it('should trigger retirement when maximum week is reached', () => {
      expect(checkRetirement(100)).toBe(false);
      expect(checkRetirement(479)).toBe(false);
      expect(checkRetirement(480)).toBe(true);
      expect(checkRetirement(481)).toBe(true);
    });
  });

  describe('Event Selection Triggering', () => {
    it('should scale triggers based on difficulty multiplier', () => {
      // Beginner trigger prob is 5%, so mock random returning 0.04 should trigger
      const mockRandomTrigger = () => 0.04;
      const mockRandomSkip = () => 0.25;

      const beginnerEvents = selectEvents(Difficulty.BEGINNER, 1, 700, 75, mockRandomTrigger);
      expect(beginnerEvents.length).toBe(1);

      const beginnerEventsSkip = selectEvents(Difficulty.BEGINNER, 1, 700, 75, mockRandomSkip);
      expect(beginnerEventsSkip.length).toBe(0);

      // Hard trigger prob is 20%, so mock random returning 0.15 should trigger
      const hardEvents = selectEvents(Difficulty.HARD, 1, 700, 75, () => 0.15);
      expect(hardEvents.length).toBe(1);
    });
  });
});

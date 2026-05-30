// src/domain/game.ts
// Pure functions for the game rules, metrics adjustments, event logic, and status checks.
// NO database access. NO side effects. Fully deterministic and unit-testable.

import { GAME_CONSTANTS } from '../config/constants';
import { Prisma } from '@prisma/client';
import { Difficulty } from '../types/enums';

export interface GameMetricUpdates {
  creditScore: number;
  socialScore: number;
  wellBeing: number;
}

export interface RandomEvent {
  eventCode: string;
  category: string;
  description: string;
  effects: {
    creditScoreDelta?: number;
    socialScoreDelta?: number;
    wellBeingDelta?: number;
    extraExpense?: number;
    salaryMultiplier?: number;
    investmentMultiplier?: number;
  };
}

/**
 * Calculates net worth based on liquid balance and the current market value of investments.
 */
export function calculateNetWorth(liquidBalance: number, investmentsValue: number): number {
  return liquidBalance + investmentsValue;
}

/**
 * Constrains the credit score between 300 and 900.
 */
export function clampCreditScore(score: number): number {
  return Math.max(
    GAME_CONSTANTS.CREDIT_SCORE_MIN,
    Math.min(GAME_CONSTANTS.CREDIT_SCORE_MAX, score)
  );
}

/**
 * Constrains the social score between 0 and 100.
 */
export function clampSocialScore(score: number): number {
  return Math.max(
    GAME_CONSTANTS.SOCIAL_SCORE_MIN,
    Math.min(GAME_CONSTANTS.SOCIAL_SCORE_MAX, score)
  );
}

/**
 * Constrains the well-being between 0 and 100.
 */
export function clampWellBeing(score: number): number {
  return Math.max(
    GAME_CONSTANTS.WELL_BEING_MIN,
    Math.min(GAME_CONSTANTS.WELL_BEING_MAX, score)
  );
}

/**
 * Bankruptcy condition: triggered if net worth is negative AND liquid balance is less than
 * the absolute sum of basic weekly obligations (which means player cannot even afford their immediate bills).
 */
export function checkBankruptcy(netWorth: number, liquidBalance: number, weeklyBillsSum: number): boolean {
  return netWorth < 0 && liquidBalance < weeklyBillsSum;
}

/**
 * Retirement condition: reached when weeks played exceed (RETIREMENT_AGE - startingAge) * 52.
 */
export function checkRetirement(currentWeek: number, startingAge: number = 22): boolean {
  const retirementWeek = (GAME_CONSTANTS.RETIREMENT_AGE - startingAge) * 52;
  return currentWeek >= retirementWeek;
}

/**
 * Predefined list of random events that can occur in the game.
 */
export const RANDOM_EVENTS_CATALOG: RandomEvent[] = [
  {
    eventCode: 'HEALTH_EMERGENCY',
    category: 'HEALTH',
    description: 'You faced a sudden health issue. Medical bills had to be paid.',
    effects: {
      wellBeingDelta: -15,
      creditScoreDelta: -10,
      extraExpense: 300_000, // ₹3,000 in paise
    },
  },
  {
    eventCode: 'JOB_PROMOTION',
    category: 'CAREER',
    description: 'Outstanding performance! You got promoted with a salary bump.',
    effects: {
      salaryMultiplier: 1.15,
      socialScoreDelta: 10,
      wellBeingDelta: 5,
    },
  },
  {
    eventCode: 'MARKET_BOOM',
    category: 'MARKET',
    description: 'The stock market skyrocketed! Your stock holdings grew in value.',
    effects: {
      investmentMultiplier: 1.25,
      socialScoreDelta: 5,
    },
  },
  {
    eventCode: 'MARKET_CRASH',
    category: 'MARKET',
    description: 'Economic volatility hits! The stock market takes a downturn.',
    effects: {
      investmentMultiplier: 0.75,
      wellBeingDelta: -10,
    },
  },
  {
    eventCode: 'MUGGING',
    category: 'SOCIAL',
    description: 'You were mugged on your way home. Lost some cash and peace of mind.',
    effects: {
      extraExpense: 50_000, // ₹500 in paise
      wellBeingDelta: -12,
    },
  },
  {
    eventCode: 'LUCKY_DIP',
    category: 'SOCIAL',
    description: 'You won a small lottery prize at a local community event!',
    effects: {
      extraExpense: -100_000, // Negative expense = gain of ₹1,000 in paise
      socialScoreDelta: 10,
      wellBeingDelta: 5,
    },
  },
];

/**
 * Probabilistically selects events based on difficulty.
 * Base probability of any event triggering in a given week is 10%.
 * BEGINNER = 0.5x base probability (5%)
 * STANDARD = 1.0x base probability (10%)
 * HARD = 2.0x base probability (20%)
 */
export function selectEvents(
  difficulty: Difficulty,
  _currentWeek: number,
  _creditScore: number,
  _wellBeing: number,
  randomProvider: () => number = Math.random
): RandomEvent[] {
  const baseProb = 0.1;
  const multiplier = GAME_CONSTANTS.DIFFICULTY_MULTIPLIERS[difficulty];
  const triggerProb = baseProb * multiplier;

  if (randomProvider() <= triggerProb) {
    // Select one random event from the catalog
    const index = Math.floor(randomProvider() * RANDOM_EVENTS_CATALOG.length);
    return [RANDOM_EVENTS_CATALOG[index]!];
  }

  return [];
}

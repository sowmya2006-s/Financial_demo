// src/config/constants.ts
// All game parameters live here. Never hardcode these in services or domain logic.

export const GAME_CONSTANTS = {
  // Career & salary
  STARTING_SALARY_PAISE: 3_000_000, // ₹30,000 per month in paise

  // Starting metric values
  DEFAULT_CREDIT_SCORE: 700,
  DEFAULT_SOCIAL_SCORE: 50,
  DEFAULT_WELL_BEING: 75,

  // Metric bounds
  CREDIT_SCORE_MIN: 300,
  CREDIT_SCORE_MAX: 900,
  SOCIAL_SCORE_MIN: 0,
  SOCIAL_SCORE_MAX: 100,
  WELL_BEING_MIN: 0,
  WELL_BEING_MAX: 100,

  // Game duration
  RETIREMENT_WEEK: 480, // 40 years × 12 months

  // Difficulty event probability multipliers
  DIFFICULTY_MULTIPLIERS: {
    BEGINNER: 0.5,
    STANDARD: 1.0,
    HARD: 2.0,
  },

  // Default obligations on profile creation (all in paise)
  DEFAULT_OBLIGATIONS: [
    { label: 'Rent', category: 'rent', amount: 1_000_000 }, // ₹10,000
    { label: 'Groceries & Utilities', category: 'utilities', amount: 500_000 }, // ₹5,000
  ],
} as const;

export const MAX_PROFILES_PER_DIFFICULTY = {
  BEGINNER: 5,
  STANDARD: 1,
  HARD: 1,
} as const;

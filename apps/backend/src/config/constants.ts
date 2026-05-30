// src/config/constants.ts
// All game parameters live here.
// NEVER hardcode these values in services or domain logic — always import from here.
// Values in paise (1 INR = 100 paise) unless noted otherwise.

export const GAME_CONSTANTS = {
  // ─── Profile Limits ──────────────────────────────────────────────────────
  MAX_PROFILES_PER_DIFFICULTY: {
    BEGINNER: 5,  // Sandbox mode — multiple financial lives allowed
    STANDARD: 1,
    HARD: 1,
  },

  // ─── Retirement ──────────────────────────────────────────────────────────
  RETIREMENT_AGE: 60,

  // ─── Starting Conditions (per spec — identical for all Beginner profiles) ─
  // These are canonical values. All BEGINNER profiles start with these exactly.
  BEGINNER_STARTING_SALARY_PAISE:  4_500_000, // ₹45,000/month
  BEGINNER_STARTING_SAVINGS_PAISE: 1_500_000, // ₹15,000
  BEGINNER_STARTING_AGE:           22,

  // Standard / Hard use age-based scaling (see domain/profile.ts)
  STANDARD_BASE_SALARY_PAISE: 5_000_000, // ₹50,000
  HARD_BASE_SALARY_PAISE:     8_000_000, // ₹80,000

  // ─── Initial Metric Values (per spec) ────────────────────────────────────
  DEFAULT_CREDIT_SCORE:  650,
  DEFAULT_SOCIAL_SCORE:  20,
  DEFAULT_WELL_BEING:    50,
  INITIAL_NET_WORTH_PAISE: 1_500_000, // ₹15,000

  // ─── Metric Bounds ────────────────────────────────────────────────────────
  CREDIT_SCORE_MIN: 300,
  CREDIT_SCORE_MAX: 900,
  SOCIAL_SCORE_MIN: 0,
  SOCIAL_SCORE_MAX: 100,
  WELL_BEING_MIN:   0,
  WELL_BEING_MAX:   100,

  // ─── Dynamic Bill Ranges (all in paise) ──────────────────────────────────
  // Amounts represent weekly cost (approximate monthly ÷ 4)
  BILLS: {
    FOOD: {
      MIN: 400_000,   // ₹4,000/month
      MAX: 700_000,   // ₹7,000/month
    },
    TRANSPORT: {
      MIN: 150_000,   // ₹1,500/month
      MAX: 400_000,   // ₹4,000/month
    },
    MOBILE: {
      MIN: 30_000,    // ₹300/month
      MAX: 80_000,    // ₹800/month
    },
    ELECTRICITY: {
      MIN: 80_000,    // ₹800/month
      MAX: 200_000,   // ₹2,000/month
    },
    WATER: {
      MIN: 30_000,    // ₹300/month
      MAX: 80_000,    // ₹800/month
    },
    INTERNET: {
      MIN: 70_000,    // ₹700/month
      MAX: 150_000,   // ₹1,500/month
    },
  },

  // ─── Income Tax Slabs (monthly salary in paise, tax as fraction) ─────────
  TAX_SLABS: [
    { maxSalary: 3_000_000, rate: 0.00 },   // < ₹30,000 → 0%
    { maxSalary: 6_000_000, rate: 0.05 },   // ₹30k–₹60k → 5%
    { maxSalary: 10_000_000, rate: 0.10 },  // ₹60k–₹1L → 10%
    { maxSalary: Infinity,  rate: 0.20 },   // ₹1L+ → 20%
  ],

  // ─── Housing Costs (monthly, in paise) ───────────────────────────────────
  HOUSING: {
    INDIVIDUAL_RENT: { MIN: 800_000, MAX: 1_500_000 },   // ₹8,000–₹15,000/month
    SHARED_RENT:     { MIN: 300_000, MAX:   600_000 },   // ₹3,000–₹6,000/month
  },

  // Keep for backward compat with housingService
  BASE_RENT_INDIVIDUAL: 1_000_000, // ₹10,000/month (midpoint)
  BASE_RENT_SHARED:       450_000, // ₹4,500/month (midpoint)

  // ─── Home Loan Defaults ───────────────────────────────────────────────────
  HOME_LOAN_DEFAULTS: {
    HOUSE_COST_PAISE:    40_000_000_00, // ₹40 Lakhs
    DOWN_PAYMENT_PAISE:   5_000_000_00, // ₹5 Lakhs
    LOAN_AMOUNT_PAISE:   35_000_000_00, // ₹35 Lakhs
    INTEREST_RATE:        8.0,           // 8% p.a.
    TENURE_MONTHS:        240,           // 20 years
  },

  // ─── Well-being Stress Threshold ─────────────────────────────────────────
  // If mandatory bills exceed this fraction of salary, apply well-being penalty
  BILL_STRESS_THRESHOLD: 0.60,          // 60%
  BILL_STRESS_WELL_BEING_PENALTY: 10,   // -10 well-being

  // ─── Credit Score Adjustments ─────────────────────────────────────────────
  CREDIT_SCORE_ON_PAID:   10,   // +10 for paying all bills on time
  CREDIT_SCORE_ON_MISSED: -30,  // -30 per missed payment (range -20 to -50)
  CREDIT_SCORE_ON_EMI_MISSED: -50, // heavier penalty for missed EMI

  // ─── Inflation ────────────────────────────────────────────────────────────
  INFLATION_MIN_PERCENT: 3,  // 3%
  INFLATION_MAX_PERCENT: 8,  // 8%
  INFLATION_APPLY_EVERY_N_WEEKS: 12, // yearly

  // ─── Rent Inflation ───────────────────────────────────────────────────────
  RENT_INFLATION: {
    INDIVIDUAL_RENT: { min: 0.05, max: 0.10 }, // 5–10% per year
    SHARED_RENT:     { min: 0.03, max: 0.06 }, // 3–6% per year
  },

  // ─── Loan Defaults ────────────────────────────────────────────────────────
  LOAN_DEFAULTS: {
    HOME:     { interestRate: 8,  tenureMonths: 240 }, // 20 years
    VEHICLE:  { interestRate: 10, tenureMonths:  60 }, //  5 years
    PERSONAL: { interestRate: 12, tenureMonths:  36 }, //  3 years
  },

  // ─── Bankruptcy Rules ─────────────────────────────────────────────────────
  BANKRUPTCY_CONSECUTIVE_WEEKS: 3,       // 3 weeks of negative balance → bankrupt
  BANKRUPTCY_NET_WORTH_THRESHOLD: -5_000_000, // net worth < -₹50,000 → bankrupt

  // ─── Difficulty Event Probability Multipliers ─────────────────────────────
  DIFFICULTY_MULTIPLIERS: {
    BEGINNER: 0.5,
    STANDARD: 1.0,
    HARD:     2.0,
  },

  // ─── Promotion Weights ────────────────────────────────────────────────────
  PROMOTION_WEIGHTS: {
    wellBeing:           0.40,
    selfInvestment:      0.35,
    workConsistency:     0.15,
    financialStability:  0.10,
  },

  // ─── Promotion Salary Increase Range ─────────────────────────────────────
  PROMOTION_SALARY_INCREASE: { min: 0.05, max: 0.15 },

  // ─── Difficulty Salary Multipliers for Bill Severity ──────────────────────
  // Bills are scaled slightly per difficulty
  BILL_DIFFICULTY_MULTIPLIERS: {
    BEGINNER: 0.85,  // slightly reduced bills in sandbox
    STANDARD: 1.00,
    HARD:     1.20,  // harder mode means higher costs
  },

  // ─── Default obligations (legacy — only EMI obligations are created here now)
  // Dynamic bills are computed by weeklyBillService each week.
  DEFAULT_OBLIGATIONS: [] as Array<{ label: string; category: string; amount: number; startWeek?: number }>,

} as const;

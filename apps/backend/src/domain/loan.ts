// src/domain/loan.ts
// Pure functions for loan business rules.
// NO database access. NO side effects. Fully deterministic and unit-testable.

import { Difficulty } from '../types/enums';

/**
 * Determines if a loan is approvable based on credit score.
 * Per specification:
 * - 750+: Easy (95% approval)
 * - 650-750: Medium (70% approval)
 * - 550-650: Risky (40% approval)
 * - <550: Often rejected (20% approval)
 */
export function getLoanApprovalChanceByCredit(creditScore: number): number {
  if (creditScore >= 750) return 0.95;
  if (creditScore >= 650) return 0.70;
  if (creditScore >= 550) return 0.40;
  return 0.20;
}

/**
 * Checks if total EMI would exceed salary capacity.
 * Per specification: Total EMI > 50% salary = too much debt
 */
export function isTooMuchDebt(totalEmiAmount: number, monthlySalary: number): boolean {
  const debtToIncomeRatio = totalEmiAmount / monthlySalary;
  return debtToIncomeRatio > 0.5;
}

/**
 * Calculates final approval probability considering all factors.
 * Formula: baseChance × difficultyMultiplier × debtMultiplier
 */
export function calculateLoanApprovalChance(
  creditScore: number,
  existingEmi: number,
  monthlySalary: number,
  difficulty: Difficulty,
  loanType: 'HOME' | 'VEHICLE' | 'PERSONAL' | 'EDUCATION'
): number {
  // Base approval chance from credit score
  let approvalChance = getLoanApprovalChanceByCredit(creditScore);

  // Difficulty multiplier (Hard mode stricter)
  const difficultyMultipliers: Record<Difficulty, number> = {
    BEGINNER: 1.2, // more lenient
    STANDARD: 1.0,
    HARD: 0.7, // stricter
  };
  approvalChance *= difficultyMultipliers[difficulty];

  // Check existing debt burden
  const totalEmi = existingEmi;
  if (isTooMuchDebt(totalEmi, monthlySalary)) {
    approvalChance *= 0.5; // Halve approval chance if debt too high
  }

  // Loan type multiplier (Personal loans harder to get)
  const loanTypeMultipliers: Record<string, number> = {
    HOME: 1.0,
    VEHICLE: 0.95,
    PERSONAL: 0.7,
    EDUCATION: 0.85,
  };
  approvalChance *= loanTypeMultipliers[loanType] || 1.0;

  // Clamp to [0, 1]
  return Math.min(1, Math.max(0, approvalChance));
}

/**
 * Determines if loan should be approved based on probability.
 * Uses deterministic seeding if seed is provided, otherwise uses Math.random()
 */
export function shouldLoanBeApproved(
  approvalChance: number,
  randomFn?: () => number
): boolean {
  const rng = randomFn || Math.random;
  return rng() < approvalChance;
}

/**
 * Gets difficulty-adjusted interest rate for a loan.
 * Hard mode charges higher interest.
 */
export function getAdjustedInterestRate(
  baseRate: number,
  difficulty: Difficulty
): number {
  const difficultyAdjustments: Record<Difficulty, number> = {
    BEGINNER: -0.5, // 0.5% lower
    STANDARD: 0, // no adjustment
    HARD: 2.0, // 2% higher
  };
  return Math.max(baseRate + difficultyAdjustments[difficulty], 0);
}

/**
 * Calculates EMI (Equated Monthly Installment) using standard formula.
 * Formula: P × r × (1 + r)^n / ((1 + r)^n - 1)
 * Where: P = principal, r = monthly interest rate, n = number of months
 */
export function calculateEmi(
  principalAmount: number, // in paise
  annualInterestRate: number, // as percentage (e.g., 8 for 8%)
  tenureMonths: number
): number {
  if (tenureMonths === 0) return principalAmount;

  const monthlyRate = annualInterestRate / 100 / 12;
  if (monthlyRate === 0) {
    return Math.round(principalAmount / tenureMonths);
  }

  const numerator = principalAmount * monthlyRate * Math.pow(1 + monthlyRate, tenureMonths);
  const denominator = Math.pow(1 + monthlyRate, tenureMonths) - 1;
  return Math.round(numerator / denominator);
}

/**
 * Calculates penalty for missed EMI payment.
 * Per specification: Late fee = 10% of EMI
 */
export function calculateMissedEmiPenalty(emiAmount: number): number {
  return Math.round(emiAmount * 0.1);
}

/**
 * Impact on credit score for missing EMI.
 * Per specification: -20 to -50 depending on frequency
 */
export function getCreditScorePenalty(missedPaymentCount: number): number {
  if (missedPaymentCount === 1) return -20;
  if (missedPaymentCount === 2) return -35;
  return -50;
}

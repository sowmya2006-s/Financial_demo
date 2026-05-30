// src/services/leaderboardService.ts
// Handles retrieving leaderboard standings for a cohort.
// Scoring formula:
// - Net Worth (35%): Higher is better
// - Credit Score (20%): 750 = max, scales down
// - Career Progression (15%): Levels/promotions
// - Well-being (10%): 0-100 scale
// - Social Status (10%): 0-100 scale
// - Financial Discipline (10%): Paid bills on time, consistent
// - Debt Penalty: Negative multiplier for high unpaid EMI

import prisma from '../config/prisma';
import { AppError } from '../middleware/errorHandler';
import { calculateNetWorth } from '../domain/game';

export interface LeaderboardEntry {
  rank: number;
  profileId: string;
  name: string;
  difficulty: string;
  currentWeek: number;
  leaderboardScore: number;
  netWorth: number;
  balance: number;
  creditScore: number;
  socialScore: number;
  wellBeing: number;
  status: string;
  careerLevel?: number;
  previousRank?: number;
}

/**
 * Calculates normalized net worth score (0-100 scale)
 * Assumes max reasonable net worth at this point is ~₹50 lakhs
 */
function calculateNetWorthScore(netWorth: number): number {
  const maxNetWorth = 5_000_000_00; // ₹50 lakhs
  const normalized = Math.min(100, (netWorth / maxNetWorth) * 100);
  return Math.max(0, normalized);
}

/**
 * Calculates credit score rating (0-100 scale)
 * 750 = 100 points, scales down from there
 */
function calculateCreditScoreRating(creditScore: number): number {
  // Clamp between 300-900
  const clamped = Math.min(900, Math.max(300, creditScore));
  // Map 300 -> 0, 750 -> 100, 900 -> 120 (but capped at 100)
  const normalized = ((clamped - 300) / (750 - 300)) * 100;
  return Math.min(100, normalized);
}

/**
 * Calculates career level score (0-100 scale)
 * Based on number of promotions/level
 */
function calculateCareerScore(careerLevel: number): number {
  // Level 1 = 20 points, Level 5 = 100 points
  return Math.min(100, careerLevel * 20);
}

/**
 * Calculates financial discipline score (0-100 scale)
 * Based on: EMI payments, bill payments, missed payments count
 */
async function calculateFinancialDisciplineScore(
  profileId: string,
  missedPayments: number,
  totalBillsProcessed: number
): Promise<number> {
  if (totalBillsProcessed === 0) return 50; // Default middle score

  // Base score: 100 - (missed_payments * penalty)
  let score = 100 - (missedPayments * 15); // -15 per missed payment
  score = Math.max(0, score);

  // Bonus for consistency (all bills paid)
  if (missedPayments === 0) {
    score = Math.min(100, score + 10);
  }

  return score;
}

/**
 * Calculates debt penalty multiplier (0.5 to 1.0)
 * High debt reduces final score
 */
async function calculateDebtPenalty(profileId: string, monthlySalary: number): Promise<number> {
  const activeLoans = await prisma.loan.findMany({
    where: { profileId, isActive: true },
  });

  const totalEmi = activeLoans.reduce((sum, loan) => sum + loan.emiAmount, 0);
  const debtRatio = monthlySalary > 0 ? totalEmi / monthlySalary : 0;

  // If debt > 50% of salary, apply penalty
  if (debtRatio > 0.5) {
    return Math.max(0.5, 1.0 - (debtRatio - 0.5));
  }
  return 1.0;
}

/**
 * Calculates final leaderboard score using weighted formula
 */
export async function calculateLeaderboardScore(
  profileId: string,
  profile: any,
  gameState: any,
  balance: number,
  investmentsValue: number
): Promise<number> {
  if (!gameState) return 0;

  // Calculate component scores
  const netWorthScore = calculateNetWorthScore(calculateNetWorth(balance, investmentsValue));
  const creditScoreRating = calculateCreditScoreRating(gameState.creditScore);
  const careerScore = calculateCareerScore(profile.careerLevel || 1);
  const wellBeingScore = gameState.wellBeing || 50;
  const socialStatusScore = gameState.socialScore || 50;
  const financialDiscipline = await calculateFinancialDisciplineScore(profileId, 0, 1);
  const debtPenalty = await calculateDebtPenalty(profileId, gameState.salary);

  // Apply weights per specification
  const weightedScore =
    netWorthScore * 0.35 +
    creditScoreRating * 0.20 +
    careerScore * 0.15 +
    wellBeingScore * 0.10 +
    socialStatusScore * 0.10 +
    financialDiscipline * 0.10;

  // Apply debt penalty
  const finalScore = Math.round(weightedScore * debtPenalty);

  return Math.max(0, finalScore);
}

export const leaderboardService = {
  /**
   * Fetches and ranks all profiles in a given cohort by leaderboard score.
   * Excludes players with fewer than 3 completed weeks (late joiners).
   */
  async getCohortLeaderboard(userId: string, cohortId: string): Promise<LeaderboardEntry[]> {
    // Basic verification: does this cohort exist?
    const cohort = await prisma.cohort.findUnique({
      where: { id: cohortId },
    });

    if (!cohort) {
      throw new AppError(404, 'COHORT_NOT_FOUND', 'Cohort not found');
    }

    // Fetch all profiles belonging to this cohort
    const profiles = await prisma.profile.findMany({
      where: { cohortId },
      include: { gameState: true },
    });

    const entries: LeaderboardEntry[] = await Promise.all(
      profiles.map(async (p, index) => {
        const state = p.gameState;
        if (!state) {
          return {
            rank: index + 1,
            profileId: p.id,
            name: p.name,
            difficulty: p.difficulty,
            currentWeek: 1,
            leaderboardScore: 0,
            netWorth: 0,
            balance: 0,
            creditScore: 700,
            socialScore: 50,
            wellBeing: 75,
            status: 'ACTIVE',
          };
        }

        // Skip late joiners (less than 3 weeks completed)
        if (state.currentWeek < 3) {
          return {
            rank: index + 1,
            profileId: p.id,
            name: p.name,
            difficulty: p.difficulty,
            currentWeek: state.currentWeek,
            leaderboardScore: 0,
            netWorth: 0,
            balance: 0,
            creditScore: state.creditScore,
            socialScore: state.socialScore,
            wellBeing: state.wellBeing,
            status: 'UNRANKED',
          };
        }

        // Calculate current liquid balance
        const balanceAgg = await prisma.transaction.aggregate({
          where: { profileId: p.id },
          _sum: { amount: true },
        });
        const balance = balanceAgg._sum.amount ?? 0;

        // Calculate investment holdings value
        const investmentsAgg = await prisma.investment.aggregate({
          where: { profileId: p.id, isActive: true },
          _sum: { currentValue: true },
        });
        const investmentsValue = investmentsAgg._sum.currentValue ?? 0;

        const netWorth = calculateNetWorth(balance, investmentsValue);

        // Calculate leaderboard score
        const leaderboardScore = await calculateLeaderboardScore(
          p.id,
          p,
          state,
          balance,
          investmentsValue
        );

        return {
          rank: index + 1,
          profileId: p.id,
          name: p.name,
          difficulty: p.difficulty,
          currentWeek: state.currentWeek,
          leaderboardScore,
          netWorth,
          balance,
          creditScore: state.creditScore,
          socialScore: state.socialScore,
          wellBeing: state.wellBeing,
          status: state.status,
          careerLevel: 1, // careerLevel tracking not yet in Profile schema
        };
      })
    );

    // Sort entries descending by leaderboard score
    entries.sort((a, b) => b.leaderboardScore - a.leaderboardScore);

    // Assign ranks and previous rank tracking
    entries.forEach((entry, index) => {
      entry.rank = index + 1;
    });

    return entries;
  },

  /**
   * Gets a specific player's rank in their cohort
   */
  async getPlayerRankInCohort(profileId: string): Promise<number> {
    const profile = await prisma.profile.findUnique({
      where: { id: profileId },
    });

    if (!profile) {
      throw new AppError(404, 'PROFILE_NOT_FOUND', 'Profile not found');
    }

    const leaderboard = await this.getCohortLeaderboard('', profile.cohortId);
    const playerEntry = leaderboard.find((e) => e.profileId === profileId);

    return playerEntry?.rank || leaderboard.length;
  },
};

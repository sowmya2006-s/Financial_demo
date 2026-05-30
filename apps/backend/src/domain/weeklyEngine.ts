import { Prisma, GameState, WeeklySummary } from '@prisma/client';
import { RandomEvent } from './game';
import { clampSocialScore } from './game';
import type { WeeklyBillResult } from '../services/weeklyBillService';

/**
 * Credit the weekly salary to the profile by creating a positive Transaction.
 */
export async function creditSalary(
  tx: Prisma.TransactionClient,
  gameState: GameState
): Promise<void> {
  // Salary is stored in paise/cents as a positive amount.
  await tx.transaction.create({
    data: {
      profileId: gameState.profileId,
      type: 'CREDIT',
      category: 'SALARY',
      amount: gameState.salary,
      gameWeek: gameState.currentWeek,
      description: 'Weekly salary credit',
    },
  });
}

// applyObligations removed — dynamic bills now handled by weeklyBillService.processWeeklyBills()

// processRandomEvents removed — random events handled by randomEventService.generateEvents()

/**
 * Recalculate social score based on net balance.
 *
 * NOTE: creditScore and wellBeing are now owned by weeklyBillService and
 * randomEventService respectively. This function only updates socialScore
 * to avoid clobbering those values.
 */
export async function recalcMetrics(
  tx: Prisma.TransactionClient,
  gameState: GameState
): Promise<void> {
  const sums = await tx.transaction.aggregate({
    where: { profileId: gameState.profileId, gameWeek: { lte: gameState.currentWeek } },
    _sum: { amount: true },
  });
  const netBalance = sums._sum.amount ?? 0;

  // Social score grows slowly with accumulated wealth
  const newSocialScore = clampSocialScore(
    gameState.socialScore + Math.floor(netBalance / 5_000_000) // +1 per ₹50k net balance
  );

  await tx.gameState.update({
    where: { profileId: gameState.profileId },
    data: { socialScore: newSocialScore },
  });
}

/**
 * Persist a WeeklySummary capturing before/after snapshots and triggered events.
 */
export function generateDifficultyGuidance(
  difficulty: string,
  afterState: GameState,
  netBalance: number,
  hasInvestments: boolean,
  hasLoans: boolean,
  rentAmount: number
): string[] {
  const hints: string[] = [];
  if (difficulty === 'BEGINNER') {
    if (netBalance > 500_000 && !hasInvestments) {
      hints.push("Suggestion: Your cash balance is high. Consider investing in a Fixed Deposit (FD) for safe interest returns.");
    }
    if (afterState.wellBeing < 40) {
      hints.push("Suggestion: Your well-being is low. Try taking a vacation or dining out to boost your health.");
    }
    if (afterState.creditScore < 600) {
      hints.push("Suggestion: Your credit score is low. Pay your bills on time and avoid taking too many loans to improve it.");
    }
    if (hasLoans && netBalance > 200_000) {
      hints.push("Suggestion: Your debt burden is high. Avoid taking new loans and focus on clearing existing EMIs.");
    }
  } else if (difficulty === 'STANDARD') {
    if (rentAmount > afterState.salary * 0.3) {
      hints.push("Descriptive Feedback: High rent is reducing your savings growth. Switching to shared housing would improve your cash flow.");
    }
    if (!hasInvestments) {
      hints.push("Descriptive Feedback: Lack of investments is keeping your wealth growth slow. Inflation will erode your savings over time.");
    }
    if (afterState.creditScore < 650) {
      hints.push("Descriptive Feedback: Low credit score is limiting your future loan options and increasing borrowing costs.");
    }
    if (afterState.wellBeing < 50) {
      hints.push("Descriptive Feedback: Low well-being reduces work consistency and increases risk of medical emergency events.");
    }
  }
  return hints;
}

/**
 * Persist a WeeklySummary capturing before/after snapshots and triggered events.
 */
export async function buildWeeklySummary(
  tx: Prisma.TransactionClient,
  profileId: string,
  before: GameState,
  after: GameState,
  events: RandomEvent[],
  billResult?: WeeklyBillResult
): Promise<WeeklySummary> {
  const profile = await tx.profile.findUnique({
    where: { id: profileId },
  });
  const difficulty = profile?.difficulty || 'BEGINNER';

  // Calculate balance from transaction ledger
  const balanceAgg = await tx.transaction.aggregate({
    where: { profileId, gameWeek: { lte: before.currentWeek } },
    _sum: { amount: true },
  });
  const balance = balanceAgg._sum.amount ?? 0;

  // Check if has investments
  const investmentsCount = await tx.investment.count({
    where: { profileId, isActive: true },
  });
  const hasInvestments = investmentsCount > 0;

  // Check if has loans
  const loansCount = await tx.loan.count({
    where: { profileId, isActive: true },
  });
  const hasLoans = loansCount > 0;

  const rentObligation = await tx.obligation.findFirst({
    where: { profileId, category: 'rent', isActive: true },
  });
  const rentAmount = rentObligation?.amount ?? 0;

  const guidance = generateDifficultyGuidance(
    difficulty,
    after,
    balance,
    hasInvestments,
    hasLoans,
    rentAmount
  );

  const explanations = events.map((e) => e.description);
  explanations.push(...guidance);

  const summary = await tx.weeklySummary.create({
    data: {
      profileId,
      gameWeek: before.currentWeek,
      beforeMetrics: JSON.stringify({
        creditScore: before.creditScore,
        socialScore: before.socialScore,
        wellBeing:   before.wellBeing,
        salary:      before.salary,
      }),
      afterMetrics: JSON.stringify({
        creditScore: after.creditScore,
        socialScore: after.socialScore,
        wellBeing:   after.wellBeing,
        salary:      after.salary,
      }),
      eventsTriggered: JSON.stringify(events.map((e) => e.eventCode)),
      explanations:    JSON.stringify(explanations),
      billsTotal:      billResult?.totalBills  ?? 0,
      billsPaid:       billResult?.totalPaid   ?? 0,
    },
  });
  return summary;
}

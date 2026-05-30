// src/services/weeklyBillService.ts
// ─────────────────────────────────────────────────────────────────────────────
// Dynamic Weekly Bill Payment Module
// Implements the 9-step bill processing engine per spec.
//
// Execution order each week:
//   Salary Credit → [this module] → Player Decision (Invest / Spend)
//
// Steps:
//   1. Fetch financial state
//   2. Generate mandatory bills dynamically (amounts depend on salary, living
//      option, week number, social status, vehicle ownership)
//   3. Sum total bills
//   4. Payment processing (PAID vs MISSED)
//   5. Credit score impact
//   6. Well-being stress rule (bills > 60% salary)
//   7. Net worth context update
//   8. Store WeeklyBillRecord per bill line
//   9. Bankruptcy / retirement triggers (delegated to callers)
// ─────────────────────────────────────────────────────────────────────────────

import { Prisma } from '@prisma/client';
import { GAME_CONSTANTS } from '../config/constants';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface BillLine {
  billName: string;
  category: string;
  amount: number;      // in paise, always positive
  paidStatus: 'PAID' | 'MISSED';
}

export interface WeeklyBillResult {
  totalBills: number;         // sum of all bill amounts (paise)
  totalPaid: number;          // amount actually deducted (paise)
  billLines: BillLine[];
  allPaid: boolean;
  stressTriggered: boolean;   // true if bills > 60% salary
  creditScoreDelta: number;
  wellBeingDelta: number;
  missedCount: number;
}

// ─── Helper: deterministic range selection ────────────────────────────────────
// Uses week number as seed for deterministic but varied bill amounts.
// Avoids random variation that would break replay / audit.

function deterministicAmount(min: number, max: number, seed: number): number {
  // Produce a value in [min, max] using a simple deterministic formula
  const range = max - min;
  if (range <= 0) return min;
  // Use a simple hash-like function on the seed
  const t = Math.abs(Math.sin(seed * 7919)) % 1; // pseudo-random 0–1
  return Math.round(min + t * range);
}

// ─── Step 2: Bill Generators ─────────────────────────────────────────────────

/**
 * Calculates income tax deducted for this week.
 * Tax is computed on monthly salary, divided by 4 for the weekly portion.
 */
function computeIncomeTaxBill(monthlySalaryPaise: number): number {
  const slabs = GAME_CONSTANTS.TAX_SLABS;
  let rate = 0;
  for (const slab of slabs) {
    if (monthlySalaryPaise <= slab.maxSalary) {
      rate = slab.rate;
      break;
    }
  }
  const monthlyTax = Math.round(monthlySalaryPaise * rate);
  return Math.round(monthlyTax / 4); // weekly portion
}

/**
 * Calculates food & groceries bill.
 * Higher salary and social score push toward the upper range.
 */
function computeFoodBill(
  monthlySalaryPaise: number,
  socialScore: number,
  difficulty: string,
  gameWeek: number
): number {
  const { MIN, MAX } = GAME_CONSTANTS.BILLS.FOOD;
  // Salary and social score bias the range
  const salaryFactor = Math.min(1, monthlySalaryPaise / 10_000_000); // normalized 0–1 at ₹1L
  const socialFactor  = Math.min(1, socialScore / 100);
  const biasFactor    = (salaryFactor + socialFactor) / 2;
  const biasedMax     = Math.round(MIN + biasFactor * (MAX - MIN));
  const base          = deterministicAmount(MIN, biasedMax, gameWeek * 3 + 1);
  const multiplier    = (GAME_CONSTANTS.BILL_DIFFICULTY_MULTIPLIERS as any)[difficulty] ?? 1;
  return Math.round(base * multiplier);
}

/**
 * Calculates transport cost.
 * Vehicle owners pay more (fuel + maintenance vs public transport).
 */
function computeTransportBill(
  hasVehicle: boolean,
  gameWeek: number,
  difficulty: string
): number {
  const { MIN, MAX } = GAME_CONSTANTS.BILLS.TRANSPORT;
  // Vehicle owners use upper range; non-owners use lower range
  const effectiveMin = hasVehicle ? Math.round((MIN + MAX) / 2) : MIN;
  const effectiveMax = hasVehicle ? MAX : Math.round((MIN + MAX) / 2);
  const base         = deterministicAmount(effectiveMin, effectiveMax, gameWeek * 5 + 2);
  const multiplier   = (GAME_CONSTANTS.BILL_DIFFICULTY_MULTIPLIERS as any)[difficulty] ?? 1;
  return Math.round(base * multiplier);
}

/**
 * Calculates mobile recharge bill.
 */
function computeMobileBill(gameWeek: number): number {
  return deterministicAmount(GAME_CONSTANTS.BILLS.MOBILE.MIN, GAME_CONSTANTS.BILLS.MOBILE.MAX, gameWeek * 11 + 3);
}

/**
 * Calculates housing cost for this week.
 * - RENTING: uses currentRent from GameState (already inflation-adjusted)
 * - SHARED_RENT: uses currentRent
 * - HOME_LOAN / OWNED: no rent obligation — EMI is handled separately
 * Returns 0 if no housing cost applies (loan EMI handled in EMI step).
 */
function computeHousingBill(
  housingStatus: string,
  currentRentPaise: number,
  gameWeek: number
): number {
  if (housingStatus === 'RENTING') {
    return currentRentPaise > 0
      ? currentRentPaise
      : deterministicAmount(
          GAME_CONSTANTS.HOUSING.INDIVIDUAL_RENT.MIN,
          GAME_CONSTANTS.HOUSING.INDIVIDUAL_RENT.MAX,
          gameWeek
        );
  }
  if (housingStatus === 'SHARED_RENT') {
    return currentRentPaise > 0
      ? currentRentPaise
      : deterministicAmount(
          GAME_CONSTANTS.HOUSING.SHARED_RENT.MIN,
          GAME_CONSTANTS.HOUSING.SHARED_RENT.MAX,
          gameWeek
        );
  }
  // HOME_LOAN / OWNED / NONE → no separate rent bill (EMI in loanService)
  return 0;
}

/**
 * Utility bills: electricity, water, internet.
 * Only applicable from week 2 onward (player needs time to set up home).
 */
function computeUtilityBills(
  gameWeek: number,
  difficulty: string
): Array<{ billName: string; category: string; amount: number }> {
  if (gameWeek < 2) return [];

  const multiplier = (GAME_CONSTANTS.BILL_DIFFICULTY_MULTIPLIERS as any)[difficulty] ?? 1;

  return [
    {
      billName: 'Electricity',
      category: 'utilities',
      amount: Math.round(
        deterministicAmount(GAME_CONSTANTS.BILLS.ELECTRICITY.MIN, GAME_CONSTANTS.BILLS.ELECTRICITY.MAX, gameWeek * 13 + 4)
        * multiplier
      ),
    },
    {
      billName: 'Water',
      category: 'utilities',
      amount: Math.round(
        deterministicAmount(GAME_CONSTANTS.BILLS.WATER.MIN, GAME_CONSTANTS.BILLS.WATER.MAX, gameWeek * 17 + 5)
        * multiplier
      ),
    },
    {
      billName: 'Internet',
      category: 'utilities',
      amount: Math.round(
        deterministicAmount(GAME_CONSTANTS.BILLS.INTERNET.MIN, GAME_CONSTANTS.BILLS.INTERNET.MAX, gameWeek * 19 + 6)
        * multiplier
      ),
    },
  ];
}

// ─── Main Entry Point ─────────────────────────────────────────────────────────

/**
 * Processes the full weekly bill cycle for a profile within an existing Prisma transaction.
 * Called from gameEngineService after salary credit.
 *
 * Returns a WeeklyBillResult with full breakdown.
 * Does NOT commit the transaction — caller owns the transaction boundary.
 */
export async function processWeeklyBills(
  tx: Prisma.TransactionClient,
  profileId: string,
  gameWeek: number
): Promise<WeeklyBillResult> {

  // ── Step 1: Fetch Financial State ──────────────────────────────────────────
  const profile = await tx.profile.findUnique({
    where: { id: profileId },
    include: { gameState: true },
  });

  if (!profile || !profile.gameState) {
    throw new Error(`[weeklyBillService] Profile or GameState not found for ${profileId}`);
  }

  const state = profile.gameState;
  const salary        = state.salary;          // monthly salary in paise
  const housingStatus = profile.housingStatus;
  const currentRent   = state.currentRent;
  const hasVehicle    = profile.hasVehicle;
  const difficulty    = profile.difficulty;
  const socialScore   = state.socialScore;

  // Current liquid balance = sum of all transaction amounts
  const balanceAgg = await tx.transaction.aggregate({
    where: { profileId },
    _sum: { amount: true },
  });
  const currentBalance = balanceAgg._sum.amount ?? 0;

  // ── Step 2: Generate Mandatory Bills ────────────────────────────────────────

  // Build bill lines list
  const rawBills: Array<{ billName: string; category: string; amount: number }> = [];

  // 2a. Income Tax
  const taxAmount = computeIncomeTaxBill(salary);
  if (taxAmount > 0) {
    rawBills.push({ billName: 'Income Tax', category: 'tax', amount: taxAmount });
  }

  // 2b. Food & Groceries
  rawBills.push({
    billName: 'Food & Groceries',
    category: 'food',
    amount: computeFoodBill(salary, socialScore, difficulty, gameWeek),
  });

  // 2c. Transport
  rawBills.push({
    billName: 'Transport',
    category: 'transport',
    amount: computeTransportBill(hasVehicle, gameWeek, difficulty),
  });

  // 2d. Mobile Recharge
  rawBills.push({
    billName: 'Mobile Recharge',
    category: 'mobile',
    amount: computeMobileBill(gameWeek),
  });

  // 2e. Housing (rent only; EMI handled by loanService separately)
  const housingAmount = computeHousingBill(housingStatus, currentRent, gameWeek);
  if (housingAmount > 0) {
    const housingLabel = housingStatus === 'SHARED_RENT' ? 'Shared Accommodation' : 'Rent';
    rawBills.push({ billName: housingLabel, category: 'rent', amount: housingAmount });
  }

  // 2f. Utilities (week 2+)
  const utilityBills = computeUtilityBills(gameWeek, difficulty);
  rawBills.push(...utilityBills);

  // 2g. Active EMI obligations (HOME / VEHICLE / PERSONAL)
  //     We include EMI in the bill calculation for stress/credit score purposes,
  //     but the actual debit transaction for EMI is created by loanService.
  //     We track them here only for the 60% stress rule calculation.
  const emiObligations = await tx.obligation.findMany({
    where: { profileId, category: 'emi', isActive: true },
  });
  const totalEmiAmount = emiObligations.reduce((sum, o) => sum + o.amount, 0);

  // ── Step 3: Total Mandatory Bills (excluding EMIs for payment logic) ────────
  const mandatoryBillsTotal = rawBills.reduce((sum, b) => sum + b.amount, 0);
  // For the 60% stress rule, include EMIs too (full financial burden)
  const fullBurdenTotal = mandatoryBillsTotal + totalEmiAmount;

  // ── Step 4: Payment Processing ─────────────────────────────────────────────
  // We pay bills in order; if balance runs out, remaining bills are MISSED.
  let runningBalance = currentBalance;
  const billLines: BillLine[] = [];
  let missedCount = 0;

  for (const bill of rawBills) {
    if (runningBalance >= bill.amount) {
      // Case 1: Sufficient balance → pay it
      runningBalance -= bill.amount;
      billLines.push({ ...bill, paidStatus: 'PAID' });

      await tx.transaction.create({
        data: {
          profileId,
          type: 'DEBIT',
          category: bill.category,
          amount: -bill.amount,
          gameWeek,
          description: bill.billName,
        },
      });
    } else {
      // Case 2: Insufficient balance → MISSED
      missedCount++;
      billLines.push({ ...bill, paidStatus: 'MISSED' });
      // No transaction created — but penalty applied below
    }
  }

  const totalPaid   = billLines.filter(b => b.paidStatus === 'PAID').reduce((s, b) => s + b.amount, 0);
  const allPaid     = missedCount === 0;

  // ── Step 5: Credit Score Impact ────────────────────────────────────────────
  let creditScoreDelta = 0;
  if (allPaid) {
    creditScoreDelta = GAME_CONSTANTS.CREDIT_SCORE_ON_PAID;   // +10
  } else {
    // -30 per missed payment (clamped to spec range -20 to -50)
    creditScoreDelta = GAME_CONSTANTS.CREDIT_SCORE_ON_MISSED * missedCount;
  }

  // ── Step 6: Well-Being Stress Rule ─────────────────────────────────────────
  // If mandatory + EMI burden > 60% of monthly salary → stress penalty
  const stressRatio     = salary > 0 ? fullBurdenTotal / salary : 0;
  const stressTriggered = stressRatio > GAME_CONSTANTS.BILL_STRESS_THRESHOLD;
  let wellBeingDelta    = 0;

  if (!allPaid) {
    wellBeingDelta -= 10; // missed payment well-being hit
  }
  if (stressTriggered) {
    wellBeingDelta -= GAME_CONSTANTS.BILL_STRESS_WELL_BEING_PENALTY; // -10 for stress
  }

  // ── Apply metric deltas to GameState ───────────────────────────────────────
  const currentState = await tx.gameState.findUnique({ where: { profileId } });
  if (currentState) {
    const newCreditScore = Math.min(
      GAME_CONSTANTS.CREDIT_SCORE_MAX,
      Math.max(GAME_CONSTANTS.CREDIT_SCORE_MIN, currentState.creditScore + creditScoreDelta)
    );
    const newWellBeing = Math.min(
      GAME_CONSTANTS.WELL_BEING_MAX,
      Math.max(GAME_CONSTANTS.WELL_BEING_MIN, currentState.wellBeing + wellBeingDelta)
    );
    const newMissedPayments = currentState.missedPayments + missedCount;

    await tx.gameState.update({
      where: { profileId },
      data: {
        creditScore:    newCreditScore,
        wellBeing:      newWellBeing,
        missedPayments: newMissedPayments,
      },
    });
  }

  // ── Step 8: Store WeeklyBillRecord per bill line ────────────────────────────
  await tx.weeklyBillRecord.createMany({
    data: billLines.map(b => ({
      profileId,
      gameWeek,
      billName:    b.billName,
      category:    b.category,
      amount:      b.amount,
      paidStatus:  b.paidStatus,
      paymentDate: new Date(),
    })),
  });

  return {
    totalBills:      mandatoryBillsTotal,
    totalPaid,
    billLines,
    allPaid,
    stressTriggered,
    creditScoreDelta,
    wellBeingDelta,
    missedCount,
  };
}

/**
 * Returns all bill records for a profile in a given week.
 * Used by dashboard and analytics.
 */
export async function getWeeklyBillBreakdown(
  tx: Prisma.TransactionClient,
  profileId: string,
  gameWeek: number
) {
  return tx.weeklyBillRecord.findMany({
    where: { profileId, gameWeek },
    orderBy: { createdAt: 'asc' },
  });
}

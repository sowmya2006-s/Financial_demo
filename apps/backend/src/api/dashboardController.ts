// src/api/dashboardController.ts
// Returns the full player dashboard after profile creation.
//
// Response matches spec exactly:
//   welcomeMessage, cohortId (#2026-W24 format), currentAge, currentWeek,
//   weeksUntilRetirement, career, salary (INR), creditScore, balance

import { Router, Request, Response, NextFunction } from 'express';
import { requireAuth } from '../middleware/auth';
import prisma from '../config/prisma';
import { calculateWeeksUntilRetirement } from '../domain/profile';
import { GAME_CONSTANTS } from '../config/constants';

const router = Router();
router.use(requireAuth);

/**
 * GET /api/dashboard/:profileId
 *
 * Returns the full player dashboard for the given profile.
 * Profile must belong to the authenticated user.
 */
router.get('/:profileId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { profileId } = req.params;
    const userId = req.user!.userId;

    const profile = await prisma.profile.findUnique({
      where: { id: profileId },
      include: {
        gameState: true,
        cohort:    true,
        obligations: { where: { isActive: true } },
        investments: { where: { isActive: true } },
        loans:       { where: { isActive: true } },
      },
    });

    if (!profile || profile.userId !== userId) {
      res.status(404).json({ error: 'Profile not found', code: 'NOT_FOUND' });
      return;
    }

    const state = profile.gameState;

    // ── Balance: sum of all transaction amounts ────────────────────────────
    const balanceAgg = await prisma.transaction.aggregate({
      where: { profileId },
      _sum:  { amount: true },
    });
    const balancePaise = balanceAgg._sum.amount ?? 0;
    const balanceINR   = Math.round(balancePaise / 100); // convert paise → INR

    // ── Investment value ───────────────────────────────────────────────────
    const investAgg = await prisma.investment.aggregate({
      where: { profileId, isActive: true },
      _sum:  { currentValue: true },
    });
    const totalInvestmentsPaise = investAgg._sum.currentValue ?? 0;

    // ── Net Worth ──────────────────────────────────────────────────────────
    const netWorthPaise = balancePaise + totalInvestmentsPaise;
    const netWorthINR   = Math.round(netWorthPaise / 100);

    // ── Retirement formula ─────────────────────────────────────────────────
    // (60 - currentAge) * 52
    const currentAge           = profile.age;
    const weeksUntilRetirement = calculateWeeksUntilRetirement(currentAge);

    // ── Cohort label ───────────────────────────────────────────────────────
    // Format: #2026-W24
    const cohortLabel = profile.cohort
      ? `#${profile.cohort.weekKey}`
      : `#${new Date().getFullYear()}-W??`;

    // ── Salary: stored in paise → display in INR ───────────────────────────
    const salaryPaise = state?.salary ?? 0;
    const salaryINR   = Math.round(salaryPaise / 100);

    // ── Housing info ───────────────────────────────────────────────────────
    const housingLabelMap: Record<string, string> = {
      NONE:       'Not Selected',
      RENTING:    'Renting (Individual)',
      SHARED_RENT:'Shared Accommodation',
      HOME_LOAN:  'Home (Loan EMI)',
      OWNED:      'Owned Home',
    };

    // ── Last week bill summary ─────────────────────────────────────────────
    const lastWeek = (state?.currentWeek ?? 1) - 1;
    let lastWeekBills = null;
    if (lastWeek >= 1) {
      const weekSummary = await prisma.weeklySummary.findUnique({
        where: { profileId_gameWeek: { profileId, gameWeek: lastWeek } },
      });
      const billRecords = await prisma.weeklyBillRecord.findMany({
        where:   { profileId, gameWeek: lastWeek },
        orderBy: { createdAt: 'asc' },
      });

      if (weekSummary) {
        lastWeekBills = {
          week:       lastWeek,
          totalBills: Math.round(weekSummary.billsTotal / 100),
          totalPaid:  Math.round(weekSummary.billsPaid  / 100),
          breakdown:  billRecords.map(b => ({
            billName:   b.billName,
            category:   b.category,
            amount:     Math.round(b.amount / 100),
            paidStatus: b.paidStatus,
          })),
        };
      }
    }

    // ── Difficulty-specific guidance ───────────────────────────────────────
    const guidance: string[] = [];
    if (profile.difficulty === 'BEGINNER' && state) {
      if (balancePaise > 500_000 && totalInvestmentsPaise === 0) {
        guidance.push('Your cash balance is high. Consider investing in a Fixed Deposit for safe returns.');
      }
      if (state.wellBeing < 40) {
        guidance.push('Your well-being is low. Consider reducing financial stress.');
      }
      if (state.creditScore < 600) {
        guidance.push('Your credit score is low. Pay your bills on time to improve it.');
      }
    }

    // ── Response ───────────────────────────────────────────────────────────
    res.status(200).json({
      // ── Core spec fields (Section 7) ──────────────────────────────────
      welcomeMessage:       `Welcome ${profile.name}`,
      cohortId:             cohortLabel,
      currentAge,
      currentWeek:          state?.currentWeek   ?? 1,
      weeksUntilRetirement,
      career:               profile.career,
      salary:               salaryINR,            // in INR for display
      creditScore:          state?.creditScore    ?? GAME_CONSTANTS.DEFAULT_CREDIT_SCORE,
      balance:              balanceINR,            // liquid cash in INR

      // ── Extended metrics ──────────────────────────────────────────────
      socialStatus:         state?.socialScore    ?? GAME_CONSTANTS.DEFAULT_SOCIAL_SCORE,
      wellBeing:            state?.wellBeing      ?? GAME_CONSTANTS.DEFAULT_WELL_BEING,
      netWorth:             netWorthINR,
      status:               state?.status         ?? 'ACTIVE',

      // ── Profile context ───────────────────────────────────────────────
      profile: {
        id:             profile.id,
        name:           profile.name,
        difficulty:     profile.difficulty,
        startingAge:    profile.startingAge,
        housingStatus:  housingLabelMap[profile.housingStatus] ?? profile.housingStatus,
        hasHomeLoan:    profile.hasHomeLoan,
        hasVehicleLoan: profile.hasVehicleLoan,
        hasPersonalLoan: profile.hasPersonalLoan,
        hasVehicle:     profile.hasVehicle,
      },

      // ── Financial positions ───────────────────────────────────────────
      salaryPaise,                              // raw paise for frontend calculations
      balancePaise,
      netWorthPaise,
      missedPayments: state?.missedPayments ?? 0,

      // ── Last week bill breakdown ──────────────────────────────────────
      lastWeekBills,

      // ── Assets / Liabilities ─────────────────────────────────────────
      investments: profile.investments.map(i => ({
        id:             i.id,
        productCode:    i.productCode,
        type:           i.type,
        name:           i.name,
        principalINR:   Math.round(i.principalAmount / 100),
        currentValueINR: Math.round(i.currentValue   / 100),
        purchasedAtWeek: i.purchasedAtWeek,
        isActive:       i.isActive,
      })),
      loans: profile.loans.map(l => ({
        id:                l.id,
        type:              l.type,
        principalINR:      Math.round(l.principalAmount / 100),
        emiAmountINR:      Math.round(l.emiAmount        / 100),
        remainingAmountINR: Math.round(l.remainingAmount / 100),
        remainingMonths:   l.remainingMonths,
        interestRate:      l.interestRate,
        isActive:          l.isActive,
      })),

      // ── Difficulty guidance ───────────────────────────────────────────
      guidance,
    });
  } catch (err) {
    next(err);
  }
});

export default router;

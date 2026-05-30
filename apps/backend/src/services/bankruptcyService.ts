// src/services/bankruptcyService.ts
// Checks bankruptcy and retirement conditions at end of each weekly tick.
//
// Bankruptcy conditions (either):
//   1. Balance < 0 AND consecutive negative balance weeks >= 3
//   2. Net Worth < -₹50,000 (BANKRUPTCY_NET_WORTH_THRESHOLD)
//
// Retirement condition:
//   currentWeek >= (RETIREMENT_AGE - startingAge) * 52
//
// NOTE: Retirement check is primarily done in gameEngineService after the
//       week increment. bankruptcyService only handles the bankruptcy path.

import { GAME_CONSTANTS } from '../config/constants';

export const bankruptcyService = {
  async checkAndHandleBankruptcy(tx: any, profileId: string): Promise<boolean> {
    const profile = await tx.profile.findUnique({
      where: { id: profileId },
      include: { gameState: true },
    });

    if (!profile || !profile.gameState || profile.gameState.status !== 'ACTIVE') return false;

    const state = profile.gameState;

    // ── Calculate liquid balance ───────────────────────────────────────────
    const balanceAgg = await tx.transaction.aggregate({
      where: { profileId },
      _sum: { amount: true },
    });
    const netBalance = balanceAgg._sum.amount ?? 0;

    // ── Calculate total active investment value ────────────────────────────
    const investAgg = await tx.investment.aggregate({
      where: { profileId, isActive: true },
      _sum: { currentValue: true },
    });
    const totalInvestments = investAgg._sum.currentValue ?? 0;

    // ── Net Worth ──────────────────────────────────────────────────────────
    const netWorth = netBalance + totalInvestments;

    // ── Track consecutive negative balance weeks ───────────────────────────
    let consecutiveNegativeWeeks = state.consecutiveNegativeWeeks;
    if (netBalance < 0) {
      consecutiveNegativeWeeks += 1;
    } else {
      consecutiveNegativeWeeks = 0;
    }

    // ── Bankruptcy Evaluation ─────────────────────────────────────────────
    const bankruptByNegativeStreak =
      netBalance < 0 &&
      consecutiveNegativeWeeks >= GAME_CONSTANTS.BANKRUPTCY_CONSECUTIVE_WEEKS;

    const bankruptByNetWorth =
      netWorth < GAME_CONSTANTS.BANKRUPTCY_NET_WORTH_THRESHOLD; // < -₹50,000

    const isBankrupt = bankruptByNegativeStreak || bankruptByNetWorth;

    if (isBankrupt) {
      await tx.gameState.update({
        where: { profileId },
        data: {
          status: 'BANKRUPT',
          consecutiveNegativeWeeks,
        },
      });
      return true;
    }

    // ── Update streak counter even if not bankrupt ─────────────────────────
    if (consecutiveNegativeWeeks !== state.consecutiveNegativeWeeks) {
      await tx.gameState.update({
        where: { profileId },
        data: { consecutiveNegativeWeeks },
      });
    }

    return false;
  },
};

// src/services/gameService.ts
// Handles game state retrieval, decision submissions, and the atomic weekly tick engine.

import { GAME_CONSTANTS } from '../config/constants';
import prisma from '../config/prisma';
import {
  calculateNetWorth,
  clampCreditScore,
  clampSocialScore,
  clampWellBeing,
  checkBankruptcy,
  checkRetirement,
  selectEvents,
} from '../domain/game';
import { AppError } from '../middleware/errorHandler';
import { advanceWeek as engineAdvanceWeek } from '../services/gameEngineService';
import { Difficulty, GameStatus, TxType } from '../types/enums';

export const gameService = {
  /**
   * Returns current game state, derived balance, net worth, and history.
   */
  async getGameState(userId: string, profileId: string) {
    const profile = await prisma.profile.findUnique({
      where: { id: profileId },
      include: { gameState: true },
    });

    if (!profile) {
      throw new AppError(404, 'PROFILE_NOT_FOUND', 'Profile not found');
    }
    if (profile.userId !== userId) {
      throw new AppError(404, 'PROFILE_NOT_FOUND', 'Profile not found');
    }

    const gameState = profile.gameState;
    if (!gameState) {
      throw new AppError(500, 'GAME_STATE_MISSING', 'Game state not initialized');
    }

    // Calculate derived liquid balance from transactions ledger
    const balanceAgg = await prisma.transaction.aggregate({
      where: { profileId },
      _sum: { amount: true },
    });
    const balance = balanceAgg._sum.amount ?? 0;

    // Calculate total current value of active investments
    const investmentsAgg = await prisma.investment.aggregate({
      where: { profileId, isActive: true },
      _sum: { currentValue: true },
    });
    const investmentsValue = investmentsAgg._sum.currentValue ?? 0;

    const netWorth = calculateNetWorth(balance, investmentsValue);

    return {
      profile: {
        id: profile.id,
        name: profile.name,
        difficulty: profile.difficulty,
        cohortId: profile.cohortId,
      },
      gameState: {
        currentWeek: gameState.currentWeek,
        salary: gameState.salary,
        creditScore: gameState.creditScore,
        socialScore: gameState.socialScore,
        wellBeing: gameState.wellBeing,
        status: gameState.status as GameStatus,
      },
      balance,
      netWorth,
    };
  },

  /**
   * Submits player decisions for the current week.
   * If decisions already exist for this week, they are replaced.
   */
  async submitDecisions(
    userId: string,
    profileId: string,
    decisions: Array<{ type: string; category: string; amount: number; metadata?: string }>
  ) {
    const profile = await prisma.profile.findUnique({
      where: { id: profileId },
      include: { gameState: true },
    });

    if (!profile || profile.userId !== userId) {
      throw new AppError(404, 'PROFILE_NOT_FOUND', 'Profile not found');
    }

    const gameState = profile.gameState;
    if (!gameState || gameState.status !== 'ACTIVE') {
      throw new AppError(400, 'GAME_INACTIVE', 'Cannot submit decisions for an inactive game');
    }

    const currentWeek = gameState.currentWeek;

    // Use transaction to delete existing decisions for the current week and insert new ones
    await prisma.$transaction(async (tx) => {
      await tx.decision.deleteMany({
        where: { profileId, gameWeek: currentWeek },
      });

      // If array is empty, we still create a placeholder decision to indicate submission happened
      if (decisions.length === 0) {
        await tx.decision.create({
          data: {
            profileId,
            gameWeek: currentWeek,
            type: 'SKIP',
            category: 'none',
            amount: 0,
            isProcessed: false,
          },
        });
      } else {
        await tx.decision.createMany({
          data: decisions.map((d) => ({
            profileId,
            gameWeek: currentWeek,
            type: d.type,
            category: d.category,
            amount: d.amount,
            metadata: d.metadata || null,
            isProcessed: false,
          })),
        });
      }
    });

    return { success: true, count: decisions.length || 1 };
  },

  /**
   * Advances the game simulation by one week.
   * Runs the 10-step atomic weekly tick within a single transaction.
   */
  async advanceWeek(userId: string, profileId: string) {
    // Load profile and game state
    const profile = await prisma.profile.findUnique({
      where: { id: profileId },
      include: { gameState: true },
    });

    if (!profile || profile.userId !== userId) {
      throw new AppError(404, 'PROFILE_NOT_FOUND', 'Profile not found');
    }

    const state = profile.gameState;
    if (!state) {
      throw new AppError(500, 'GAME_STATE_MISSING', 'Game state not initialized');
    }

    // Precondition: must be active
    if (state.status !== 'ACTIVE') {
      throw new AppError(400, 'GAME_INACTIVE', 'Cannot advance a retired or bankrupt simulation');
    }

    // Ensure decisions have been submitted for this week
    const decisionCount = await prisma.decision.count({
      where: { profileId, gameWeek: state.currentWeek },
    });
    if (decisionCount === 0) {
      throw new AppError(
        400,
        'DECISIONS_REQUIRED',
        'You must submit decisions (even an empty list) before advancing the week'
      );
    }

    // Cohort Lockstep Progression check
    const cohortId = profile.cohortId;
    const currentWeek = state.currentWeek;

    // Count only ACTIVE players at the same week (ignores old/bankrupt/retired test profiles)
    const totalCohortPlayers = await prisma.profile.count({
      where: {
        cohortId,
        gameState: { status: 'ACTIVE', currentWeek },
      },
    });

    // Count how many of those active same-week players have submitted decisions
    const readyProfiles = await prisma.decision.groupBy({
      by: ['profileId'],
      where: {
        gameWeek: currentWeek,
        profile: {
          cohortId,
          gameState: { status: 'ACTIVE', currentWeek },
        },
      },
    });
    const readyCount = readyProfiles.length;

    // Lock only if multiple active players and < 80% ready
    if (totalCohortPlayers > 1 && (readyCount / totalCohortPlayers) < 0.8) {
      throw new AppError(
        403,
        'COHORT_LOCKED',
        `Waiting for cohort. ${readyCount} / ${totalCohortPlayers} active players ready.`
      );
    }

    // Delegate to the weekly engine service
    const summary = await engineAdvanceWeek(profileId);
    return summary;
  },

  /**
   * Returns list of transaction history and weekly summaries.
   */
  async getHistory(userId: string, profileId: string) {
    const profile = await prisma.profile.findUnique({
      where: { id: profileId },
    });

    if (!profile || profile.userId !== userId) {
      throw new AppError(404, 'PROFILE_NOT_FOUND', 'Profile not found');
    }

    const transactions = await prisma.transaction.findMany({
      where: { profileId },
      orderBy: { createdAt: 'desc' },
    });

    const summaries = await prisma.weeklySummary.findMany({
      where: { profileId },
      orderBy: { gameWeek: 'desc' },
    });

    return {
      transactions: transactions.map((t) => ({
        id: t.id,
        type: t.type,
        category: t.category,
        amount: t.amount,
        gameWeek: t.gameWeek,
        description: t.description,
        createdAt: t.createdAt,
      })),
      summaries: summaries.map((s) => ({
        id: s.id,
        gameWeek: s.gameWeek,
        beforeMetrics: JSON.parse(s.beforeMetrics),
        afterMetrics: JSON.parse(s.afterMetrics),
        eventsTriggered: JSON.parse(s.eventsTriggered),
        explanations: JSON.parse(s.explanations),
      })),
    };
  },

  /**
   * Returns details for a specific weekly summary.
   */
  async getWeeklySummary(userId: string, profileId: string, week: number) {
    const profile = await prisma.profile.findUnique({
      where: { id: profileId },
    });

    if (!profile || profile.userId !== userId) {
      throw new AppError(404, 'PROFILE_NOT_FOUND', 'Profile not found');
    }

    const summary = await prisma.weeklySummary.findUnique({
      where: {
        profileId_gameWeek: {
          profileId,
          gameWeek: week,
        },
      },
    });

    if (!summary) {
      throw new AppError(404, 'SUMMARY_NOT_FOUND', 'Weekly summary not found');
    }

    return {
      id: summary.id,
      gameWeek: summary.gameWeek,
      beforeMetrics: JSON.parse(summary.beforeMetrics),
      afterMetrics: JSON.parse(summary.afterMetrics),
      eventsTriggered: JSON.parse(summary.eventsTriggered),
      explanations: JSON.parse(summary.explanations),
    };
  },
};

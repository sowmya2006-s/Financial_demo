// src/services/gameEngineService.ts
// Orchestrates the 10-step atomic weekly tick engine.
// All steps run inside a single Prisma transaction for data integrity.

import prisma from '../config/prisma';
import { creditSalary, recalcMetrics, buildWeeklySummary } from '../domain/weeklyEngine';
import { processWeeklyBills } from './weeklyBillService';
import { loanService } from './loanService';
import { randomEventService } from './randomEventService';
import { investService } from './investService';
import { careerService } from './careerService';
import { inflationService } from './inflationService';
import { bankruptcyService } from './bankruptcyService';
import { hasReachedRetirement } from '../domain/profile';

export async function advanceWeek(profileId: string) {
  return await prisma.$transaction(async (tx) => {
    // ── Pre-flight checks ──────────────────────────────────────────────────
    let gameState = await tx.gameState.findUnique({ where: { profileId } });
    const profile  = await tx.profile.findUnique({ where: { id: profileId } });

    if (!gameState || !profile) throw new Error('GameState or Profile not found');
    if (gameState.status !== 'ACTIVE') throw new Error('Game is not active');

    const beforeMetrics  = { ...gameState };
    const currentWeek    = gameState.currentWeek;

    // ── Step 1: Salary Credit ──────────────────────────────────────────────
    await creditSalary(tx, gameState);

    // ── Step 2–8: Dynamic Weekly Bill Engine ──────────────────────────────
    // Replaces the old static applyObligations call.
    // Handles: tax, food, transport, mobile, housing, utilities.
    // Also handles: PAID/MISSED tracking, credit score, well-being stress rule.
    const billResult = await processWeeklyBills(tx, profileId, currentWeek);

    // ── Step 3 (legacy slot): EMI Deductions ──────────────────────────────
    // EMI payments are handled by loanService (separate from dynamic bills).
    await loanService.processEmiPayment(tx, profileId, currentWeek);

    // ── Step 4: Player Decisions ───────────────────────────────────────────
    // Decisions processed via their own API calls (invest, spend, loan).
    // Here we mark any remaining unprocessed decisions as processed.
    const decisions = await tx.decision.findMany({
      where: { profileId, gameWeek: currentWeek, isProcessed: false },
    });
    for (const d of decisions) {
      await tx.decision.update({ where: { id: d.id }, data: { isProcessed: true } });
    }

    // ── Step 5: Investment Returns ─────────────────────────────────────────
    await investService.applyInvestmentReturns(tx, profileId, currentWeek);

    // ── Step 6: Random Events ──────────────────────────────────────────────
    const events = await randomEventService.generateEvents(tx, profileId, currentWeek);

    // ── Step 7: Inflation Engine (every 12 weeks = yearly) ─────────────────
    await inflationService.applyYearlyInflation(tx, profileId, currentWeek);

    // ── Step 8: Career Progression ─────────────────────────────────────────
    const promotion = await careerService.checkPromotion(tx, profileId);

    // ── Step 9: Recalc derived metrics ─────────────────────────────────────
    await recalcMetrics(tx, gameState);

    // ── Step 9a: Bankruptcy check ──────────────────────────────────────────
    const isBankrupt = await bankruptcyService.checkAndHandleBankruptcy(tx, profileId);

    // ── Step 9b: Retirement check ──────────────────────────────────────────
    if (!isBankrupt) {
      const newWeekForRetirementCheck = currentWeek + 1;
      const startingAge = profile.startingAge ?? profile.age;

      if (hasReachedRetirement(newWeekForRetirementCheck, startingAge)) {
        await tx.gameState.update({
          where: { profileId },
          data: { status: 'RETIRED' },
        });
      }
    }

    // ── Step 10: Increment Week and Age ────────────────────────────────────
    gameState = await tx.gameState.findUnique({ where: { profileId } }) as any;
    const newWeek = gameState!.currentWeek + 1;

    // Age increments every 52 weeks (1 game year)
    const yearsElapsedBefore = Math.floor(gameState!.currentWeek / 52);
    const yearsElapsedAfter  = Math.floor(newWeek / 52);
    const shouldAgeUp        = yearsElapsedAfter > yearsElapsedBefore;

    const afterState = await tx.gameState.update({
      where: { profileId },
      data: {
        currentWeek: newWeek,
        updatedAt:   new Date(),
      },
    });

    if (shouldAgeUp) {
      await tx.profile.update({
        where: { id: profileId },
        data:  { age: profile.age + 1 },
      });
    }

    // ── Step 11: End-of-Week Summary ────────────────────────────────────────
    const eventDescriptions = events.map(e => e.description);
    if (promotion) {
      eventDescriptions.push(
        `Promoted to ${promotion.newTitle} — new salary ₹${(promotion.newSalary / 100).toLocaleString()}`
      );
    }

    const summary = await buildWeeklySummary(
      tx,
      profileId,
      beforeMetrics as any,
      afterState   as any,
      events       as any,
      billResult,
    );

    if (promotion) {
      const expl = JSON.parse(summary.explanations);
      expl.push(`Promoted to ${promotion.newTitle}`);
      await tx.weeklySummary.update({
        where: { id: summary.id },
        data:  { explanations: JSON.stringify(expl) },
      });
    }

    return {
      ...summary,
      billBreakdown: billResult.billLines,
      billsTotal:    billResult.totalBills,
      billsPaid:     billResult.totalPaid,
      allBillsPaid:  billResult.allPaid,
      stressTriggered: billResult.stressTriggered,
      creditScoreDelta: billResult.creditScoreDelta,
    };
  });
}

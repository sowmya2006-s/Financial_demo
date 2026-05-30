import prisma from '../config/prisma';
import { clampWellBeing, clampSocialScore, clampCreditScore } from '../domain/game';
import { GAME_CONSTANTS } from '../config/constants';
import { Difficulty } from '../types/enums';
import { insuranceService, InsuranceType } from './insuranceService';
import { Prisma } from '@prisma/client';

/**
 * Event template definitions per specification
 * Format: { eventCode, category, description, baseImpact, eventType }
 */
const EVENT_CATALOG = {
  // CAREER EVENTS
  JOB_LOSS: {
    eventCode: 'JOB_LOSS',
    category: 'CAREER',
    description: 'Your company downsized and you lost your job.',
    baseImpact: 0, // salary becomes 0
    effects: { salaryMultiplier: 0, wellBeingDelta: -20, socialScoreDelta: -8, creditScoreDelta: -10 },
  },
  SALARY_FREEZE: {
    eventCode: 'SALARY_FREEZE',
    category: 'CAREER',
    description: 'Your salary growth was frozen for the next 3 months.',
    baseImpact: 0,
    effects: { salaryMultiplier: 1, wellBeingDelta: -5, socialScoreDelta: 0, creditScoreDelta: 0 },
  },

  // HEALTH EVENTS
  ILLNESS: {
    eventCode: 'ILLNESS',
    category: 'HEALTH',
    description: 'You fell sick and had to visit the doctor.',
    baseImpact: 'SALARY_PERCENT', // calculated as salary * 0.10
    multiplier: 0.1,
    effects: { wellBeingDelta: -10, creditScoreDelta: 0 },
  },
  MEDICAL_EMERGENCY: {
    eventCode: 'MEDICAL_EMERGENCY',
    category: 'HEALTH',
    description: 'Medical emergency requiring hospitalization.',
    baseImpact: 'SALARY_PERCENT',
    multiplier: 0.3, // 30% of salary
    effects: { wellBeingDelta: -20, creditScoreDelta: -10 },
    insuranceType: InsuranceType.HEALTH,
  },

  // MARKET EVENTS
  MARKET_CRASH: {
    eventCode: 'MARKET_CRASH',
    category: 'MARKET',
    description: 'Stock market crashed -18%',
    baseImpact: 'PORTFOLIO_PERCENT',
    multiplier: 0.18,
    effects: { wellBeingDelta: -4, creditScoreDelta: 0 },
  },
  INFLATION_SPIKE: {
    eventCode: 'INFLATION_SPIKE',
    category: 'MARKET',
    description: 'Inflation increased expenses by 15%.',
    baseImpact: 'BILL_PERCENT',
    multiplier: 0.15,
    effects: { wellBeingDelta: -5, creditScoreDelta: 0 },
  },

  // SOCIAL EVENTS
  PEER_PRESSURE_BUY: {
    eventCode: 'PEER_PRESSURE_BUY',
    category: 'SOCIAL',
    description: 'Your friends bought new gadgets. You felt pressured to buy too.',
    baseImpact: 900_000, // ₹90,000 - iPhone price
    effects: { wellBeingDelta: 3, socialScoreDelta: 5, creditScoreDelta: 0 },
  },

  // POSITIVE EVENTS
  BONUS: {
    eventCode: 'BONUS',
    category: 'CAREER',
    description: 'Received a performance bonus!',
    baseImpact: 300_000, // ₹3,000
    effects: { wellBeingDelta: 5, creditScoreDelta: 0 },
    isPositive: true,
  },
  INVESTMENT_GAIN: {
    eventCode: 'INVESTMENT_GAIN',
    category: 'MARKET',
    description: 'Your investments performed well!',
    baseImpact: 'PORTFOLIO_PERCENT',
    multiplier: 0.1,
    effects: { wellBeingDelta: 3, creditScoreDelta: 0 },
    isPositive: true,
  },
  TAX_REFUND: {
    eventCode: 'TAX_REFUND',
    category: 'FINANCIAL',
    description: 'You received a tax refund!',
    baseImpact: 500_000, // ₹5,000
    effects: { wellBeingDelta: 2, creditScoreDelta: 0 },
    isPositive: true,
  },
  PROMOTION: {
    eventCode: 'PROMOTION',
    category: 'CAREER',
    description: 'You got promoted!',
    baseImpact: 'SALARY_PERCENT',
    multiplier: 0.1, // 10% salary increase
    effects: { wellBeingDelta: 10, creditScoreDelta: 5, socialScoreDelta: 3 },
    isPositive: true,
  },
};

/**
 * Calculates event occurrence probability per specification:
 * Event Chance = Base Chance × Difficulty Multiplier × Player State Modifier
 */
function calculateEventProbability(
  difficulty: Difficulty,
  gameState: any,
  profile: any
): number {
  let baseChance = 0.15; // 15% base

  // Difficulty multiplier
  const difficultyMultipliers: Record<Difficulty, number> = {
    BEGINNER: 0.5,
    STANDARD: 1.0,
    HARD: 1.8,
  };
  let chance = baseChance * difficultyMultipliers[difficulty];

  // Player state modifiers
  // Low well-being increases event chance
  if (gameState.wellBeing < 40) {
    chance *= 1.5;
  } else if (gameState.wellBeing > 70) {
    chance *= 0.8; // Good well-being reduces negative events
  }

  // Low credit score increases negative events
  if (gameState.creditScore < 600) {
    chance *= 1.3;
  }

  // High debt increases financial stress events
  const existingLoans = profile.hasHomeLoan || profile.hasVehicleLoan || profile.hasPersonalLoan;
  if (existingLoans) {
    chance *= 1.2;
  }

  // Cap at reasonable max
  return Math.min(0.5, chance);
}

/**
 * Calculates event impact/severity per specification:
 * Impact = Base Impact × Difficulty × Player Modifier
 */
function calculateEventSeverity(
  baseImpact: number,
  difficulty: Difficulty,
  wellBeing: number
): number {
  // Difficulty affects severity
  const difficultyMultipliers: Record<Difficulty, number> = {
    BEGINNER: 0.7,
    STANDARD: 1.0,
    HARD: 2.0,
  };

  // Player condition affects severity
  let playerModifier = 1.0;
  if (wellBeing < 40) playerModifier += 0.5; // More severe for struggling players
  if (wellBeing > 70) playerModifier *= 0.8; // Less severe for thriving players

  return Math.round(baseImpact * difficultyMultipliers[difficulty] * playerModifier);
}

/**
 * Selects which events to trigger for a given week.
 * Currently triggers at most one event per week.
 */
function selectEventsForWeek(
  allEvents: any[],
  eventProbability: number
): any[] {
  if (Math.random() > eventProbability) {
    return []; // No event this week
  }

  // Weight toward negative events unless well-being is high
  const negativeEvents = allEvents.filter((e) => !e.isPositive);
  const positiveEvents = allEvents.filter((e) => e.isPositive);

  const selectedList = negativeEvents.length > 0 ? negativeEvents : positiveEvents;
  const selected = selectedList[Math.floor(Math.random() * selectedList.length)];

  return selected ? [selected] : [];
}

export const randomEventService = {
  /**
   * Generates and processes random events for a profile in a given week.
   * Returns the list of event records created.
   */
  async generateEvents(tx: Prisma.TransactionClient, profileId: string, gameWeek: number) {
    const profile = await tx.profile.findUnique({
      where: { id: profileId },
      include: { gameState: true },
    });

    if (!profile || !profile.gameState) return [];

    const difficulty = profile.difficulty as Difficulty;
    const gameState = profile.gameState;

    // Calculate event probability
    const eventProbability = calculateEventProbability(difficulty, gameState, profile);

    // Select events for this week
    const triggeredEvents = selectEventsForWeek(Object.values(EVENT_CATALOG), eventProbability);

    const createdRecords = [];

    for (const eventTemplate of triggeredEvents) {
      // Calculate actual impact based on difficulty and player state
      let impactAmount = eventTemplate.baseImpact;

      if (typeof impactAmount === 'number') {
        impactAmount = calculateEventSeverity(impactAmount, difficulty, gameState.wellBeing);
      } else if (impactAmount === 'SALARY_PERCENT') {
        impactAmount = calculateEventSeverity(
          Math.round(gameState.salary * eventTemplate.multiplier),
          difficulty,
          gameState.wellBeing
        );
      } else if (impactAmount === 'PORTFOLIO_PERCENT') {
        // Calculate portfolio value
        const investments = await tx.investment.findMany({
          where: { profileId, isActive: true },
        });
        const portfolioValue = investments.reduce((sum, inv) => sum + inv.currentValue, 0);
        impactAmount = calculateEventSeverity(
          Math.round(portfolioValue * eventTemplate.multiplier),
          difficulty,
          gameState.wellBeing
        );
      } else if (impactAmount === 'BILL_PERCENT') {
        // Calculate total bills
        const obligations = await tx.obligation.findMany({
          where: { profileId, isActive: true },
        });
        const totalBills = obligations.reduce((sum, obl) => sum + obl.amount, 0);
        impactAmount = calculateEventSeverity(
          Math.round(totalBills * eventTemplate.multiplier),
          difficulty,
          gameState.wellBeing
        );
      }

      // Create event record
      const eventRecord = await tx.gameEvent.create({
        data: {
          profileId,
          gameWeek,
          eventCode: eventTemplate.eventCode,
          category: eventTemplate.category,
          description: eventTemplate.description,
          effects: JSON.stringify(eventTemplate.effects),
        },
      });

      // Apply effects
      const effects = eventTemplate.effects;

      // Check for insurance coverage
      let playerPayment = impactAmount;
      let insurancePayment = 0;

      if (eventTemplate.insuranceType && !eventTemplate.isPositive) {
        const claim = await insuranceService.processClaim(
          tx,
          profileId,
          eventTemplate.eventCode as any,
          impactAmount
        );
        playerPayment = claim.playerPayment;
        insurancePayment = claim.insurancePayment;
      }

      // Apply financial impact
      if (playerPayment > 0) {
        await tx.transaction.create({
          data: {
            profileId,
            type: eventTemplate.isPositive ? 'CREDIT' : 'DEBIT',
            category: 'event',
            amount: eventTemplate.isPositive ? playerPayment : -playerPayment,
            gameWeek,
            description: eventTemplate.description,
          },
        });
      }

      // Apply salary changes
      if (effects.salaryMultiplier !== undefined) {
        await tx.gameState.update({
          where: { profileId },
          data: {
            salary: Math.round(gameState.salary * effects.salaryMultiplier),
          },
        });
      }

      // Apply metric changes
      const metricUpdates: any = {};
      if (effects.wellBeingDelta) {
        metricUpdates.wellBeing = clampWellBeing(gameState.wellBeing + effects.wellBeingDelta);
      }
      if (effects.socialScoreDelta) {
        metricUpdates.socialScore = clampSocialScore(gameState.socialScore + effects.socialScoreDelta);
      }
      if (effects.creditScoreDelta) {
        metricUpdates.creditScore = clampCreditScore(gameState.creditScore + effects.creditScoreDelta);
      }

      if (Object.keys(metricUpdates).length > 0) {
        await tx.gameState.update({
          where: { profileId },
          data: metricUpdates,
        });
      }

      createdRecords.push(eventRecord);
    }

    return createdRecords;
  },
};

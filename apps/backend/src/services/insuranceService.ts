// src/services/insuranceService.ts
// Handles insurance products, purchases, claims, and payouts.
// Insurance protects players from random events by reducing their impact.

import prisma from '../config/prisma';
import { AppError } from '../middleware/errorHandler';
import { Prisma } from '@prisma/client';

export enum InsuranceType {
  HEALTH = 'HEALTH',
  VEHICLE = 'VEHICLE',
  PROPERTY = 'PROPERTY',
  JOB = 'JOB',
}

export interface InsuranceProduct {
  type: InsuranceType;
  name: string;
  monthlyPremium: number; // in paise
  coveragePercent: number; // e.g., 80 for 80%
  maxPayout: number; // in paise, cap on claim
  description: string;
}

export const INSURANCE_PRODUCTS: InsuranceProduct[] = [
  {
    type: InsuranceType.HEALTH,
    name: 'Health Insurance',
    monthlyPremium: 100_000, // ₹1,000/month
    coveragePercent: 80,
    maxPayout: 500_000_00, // ₹5,00,000 max
    description: 'Covers medical emergencies, hospitalization, and illness expenses.',
  },
  {
    type: InsuranceType.VEHICLE,
    name: 'Vehicle Insurance',
    monthlyPremium: 70_000, // ₹700/month
    coveragePercent: 90,
    maxPayout: 200_000_00, // ₹2,00,000 max
    description: 'Covers accidents, repairs, and vehicle damage.',
  },
  {
    type: InsuranceType.PROPERTY,
    name: 'Property Insurance',
    monthlyPremium: 150_000, // ₹1,500/month
    coveragePercent: 85,
    maxPayout: 800_000_00, // ₹8,00,000 max
    description: 'Covers house damage, fire, natural disasters, and repairs.',
  },
  {
    type: InsuranceType.JOB,
    name: 'Job Loss Insurance',
    monthlyPremium: 120_000, // ₹1,200/month
    coveragePercent: 50, // covers 50% of salary
    maxPayout: 300_000_00, // ₹3,00,000 max total
    description: 'Provides 50% salary support for up to 3 months during job loss.',
  },
];

export const insuranceService = {
  /**
   * Returns list of available insurance products.
   */
  getProducts(): InsuranceProduct[] {
    return INSURANCE_PRODUCTS;
  },

  /**
   * Purchases an insurance policy for a profile.
   * Adds monthly premium to obligations.
   */
  async purchaseInsurance(
    userId: string,
    profileId: string,
    insuranceType: InsuranceType
  ) {
    return await prisma.$transaction(async (tx) => {
      // Verify profile ownership
      const profile = await tx.profile.findUnique({
        where: { id: profileId },
        include: { gameState: true, user: true },
      });

      if (!profile || profile.userId !== userId) {
        throw new AppError(404, 'PROFILE_NOT_FOUND', 'Profile not found');
      }

      if (!profile.gameState) {
        throw new AppError(400, 'GAME_INACTIVE', 'Game state not initialized');
      }

      // Check if already insured by looking for active insurance obligation
      const existing = await tx.obligation.findFirst({
        where: { profileId, category: 'insurance', label: { contains: insuranceType }, isActive: true },
      });

      if (existing) {
        throw new AppError(409, 'ALREADY_INSURED', `You already have ${insuranceType} insurance`);
      }

      const product = INSURANCE_PRODUCTS.find((p) => p.type === insuranceType);
      if (!product) {
        throw new AppError(400, 'INVALID_INSURANCE_TYPE', 'Invalid insurance type');
      }

      // Create insurance obligation as the record of purchase
      const label = `${insuranceType} Premium`;
      const obligation = await tx.obligation.create({
        data: {
          profileId,
          label,
          category: 'insurance',
          amount: product.monthlyPremium,
          isActive: true,
          startWeek: profile.gameState.currentWeek + 1,
        },
      });

      return { id: obligation.id, type: insuranceType, monthlyPremium: product.monthlyPremium, isActive: true };
    });
  },

  /**
   * Gets all active insurance policies for a profile.
   */
  async getActiveInsurance(profileId: string) {
    const obligations = await prisma.obligation.findMany({
      where: { profileId, category: 'insurance', isActive: true },
    });
    return obligations.map(o => ({ id: o.id, type: o.label.replace(' Premium', ''), monthlyPremium: o.amount, isActive: o.isActive }));
  },

  /**
   * Checks if a profile has specific insurance type.
   */
  async hasInsurance(profileId: string, insuranceType: InsuranceType): Promise<boolean> {
    const obl = await prisma.obligation.findFirst({
      where: { profileId, category: 'insurance', label: { contains: insuranceType }, isActive: true },
    });
    return !!obl;
  },

  /**
   * Processes insurance claim when a covered event occurs.
   * Returns { playerPayment, insurancePayment, isFullyCovered }
   */
  async processClaim(
    tx: Prisma.TransactionClient,
    profileId: string,
    eventType: 'MEDICAL_EMERGENCY' | 'ACCIDENT' | 'PROPERTY_DAMAGE' | 'JOB_LOSS',
    eventAmount: number
  ): Promise<{
    playerPayment: number;
    insurancePayment: number;
    isFullyCovered: boolean;
  }> {
    // Map event type to insurance type
    const insuranceTypeMap: Record<string, InsuranceType> = {
      MEDICAL_EMERGENCY: InsuranceType.HEALTH,
      ACCIDENT: InsuranceType.VEHICLE,
      PROPERTY_DAMAGE: InsuranceType.PROPERTY,
      JOB_LOSS: InsuranceType.JOB,
    };

    const insuranceType = insuranceTypeMap[eventType];
    if (!insuranceType) {
      // No insurance applicable
      return {
        playerPayment: eventAmount,
        insurancePayment: 0,
        isFullyCovered: false,
      };
    }

    // Find active insurance obligation for this type
    const insuranceObl = await tx.obligation.findFirst({
      where: { profileId, category: 'insurance', label: { contains: insuranceType }, isActive: true },
    });

    if (!insuranceObl) {
      return { playerPayment: eventAmount, insurancePayment: 0, isFullyCovered: false };
    }

    const product = INSURANCE_PRODUCTS.find(p => p.type === insuranceType)!;
    const claimAmount = Math.min(
      Math.round(eventAmount * (product.coveragePercent / 100)),
      product.maxPayout
    );
    const playerPayment = eventAmount - claimAmount;
    const isFullyCovered = playerPayment === 0;

    // Record insurance payout as transaction
    if (claimAmount > 0) {
      const currentWeek = (await tx.gameState.findUnique({ where: { profileId } }))?.currentWeek || 1;
      await tx.transaction.create({
        data: {
          profileId,
          type: 'CREDIT',
          category: 'insurance_payout',
          amount: claimAmount,
          gameWeek: currentWeek,
          description: `Insurance claim payout for ${eventType}`,
        },
      });
    }

    return {
      playerPayment,
      insurancePayment: claimAmount,
      isFullyCovered,
    };
  },

  /**
   * Cancels/deactivates an insurance policy.
   */
  async cancelInsurance(userId: string, profileId: string, insuranceType: InsuranceType) {
    return await prisma.$transaction(async (tx) => {
      const profile = await tx.profile.findUnique({ where: { id: profileId } });
      if (!profile || profile.userId !== userId) {
        throw new AppError(404, 'PROFILE_NOT_FOUND', 'Profile not found');
      }

      const insuranceObl = await tx.obligation.findFirst({
        where: { profileId, category: 'insurance', label: { contains: insuranceType }, isActive: true },
      });

      if (!insuranceObl) {
        throw new AppError(404, 'INSURANCE_NOT_FOUND', 'Insurance policy not found');
      }

      // Deactivate corresponding obligation
      await tx.obligation.update({
        where: { id: insuranceObl.id },
        data: { isActive: false },
      });

      return { id: insuranceObl.id, type: insuranceType, isActive: false };
    });
  },
};

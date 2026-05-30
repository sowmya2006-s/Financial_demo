// src/services/financeService.ts
// Handles the portfolio listing, product catalog, purchasing investments, and redeeming investments.

import prisma from '../config/prisma';
import { AppError } from '../middleware/errorHandler';
import { GameStatus, TxType } from '../types/enums';

export interface InvestmentProduct {
  productCode: string;
  name: string;
  type: 'FD' | 'MUTUAL_FUND' | 'STOCK';
  expectedReturn: string;
  risk: 'LOW' | 'MEDIUM' | 'HIGH';
  description: string;
}

export const INVESTMENT_PRODUCTS: InvestmentProduct[] = [
  {
    productCode: 'FD_6M',
    name: 'Secure Fixed Deposit (6 Months)',
    type: 'FD',
    expectedReturn: '6% p.a.',
    risk: 'LOW',
    description: 'A risk-free investment offering stable but modest returns.',
  },
  {
    productCode: 'NIFTY_MF',
    name: 'Diversified Index Mutual Fund',
    type: 'MUTUAL_FUND',
    expectedReturn: '12% p.a. (expected)',
    risk: 'MEDIUM',
    description: 'Balanced risk portfolio tracks the top market indices.',
  },
  {
    productCode: 'STOCK_TECH',
    name: 'High-Growth Tech Equity Basket',
    type: 'STOCK',
    expectedReturn: '18% p.a. (volatile)',
    risk: 'HIGH',
    description: 'High return potential but subject to significant market shifts.',
  },
];

export const financeService = {
  /**
   * Returns static list of investment products.
   */
  getProducts(): InvestmentProduct[] {
    return INVESTMENT_PRODUCTS;
  },

  /**
   * Returns current active investments and obligations for a profile.
   */
  async getPortfolio(userId: string, profileId: string) {
    const profile = await prisma.profile.findUnique({
      where: { id: profileId },
    });

    if (!profile || profile.userId !== userId) {
      throw new AppError(404, 'PROFILE_NOT_FOUND', 'Profile not found');
    }

    const investments = await prisma.investment.findMany({
      where: { profileId },
      orderBy: { createdAt: 'desc' },
    });

    const obligations = await prisma.obligation.findMany({
      where: { profileId },
      orderBy: { createdAt: 'desc' },
    });

    return {
      investments: investments.map((i) => ({
        id: i.id,
        productCode: i.productCode,
        type: i.type,
        principalAmount: i.principalAmount,
        currentValue: i.currentValue,
        purchasedAtWeek: i.purchasedAtWeek,
        isActive: i.isActive,
        createdAt: i.createdAt,
      })),
      obligations: obligations.map((o) => ({
        id: o.id,
        label: o.label,
        category: o.category,
        amount: o.amount,
        isActive: o.isActive,
      })),
    };
  },

  /**
   * Purchases an investment product.
   */
  async invest(userId: string, profileId: string, productCode: string, amount: number) {
    const profile = await prisma.profile.findUnique({
      where: { id: profileId },
      include: { gameState: true },
    });

    if (!profile || profile.userId !== userId) {
      throw new AppError(404, 'PROFILE_NOT_FOUND', 'Profile not found');
    }

    const state = profile.gameState;
    if (!state || state.status !== 'ACTIVE') {
      throw new AppError(400, 'GAME_INACTIVE', 'Cannot invest in an inactive game');
    }

    const product = INVESTMENT_PRODUCTS.find((p) => p.productCode === productCode);
    if (!product) {
      throw new AppError(400, 'INVALID_PRODUCT', `Investment product ${productCode} does not exist`);
    }

    if (amount <= 0) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Investment amount must be greater than zero');
    }

    // Get current liquid balance
    const balanceAgg = await prisma.transaction.aggregate({
      where: { profileId },
      _sum: { amount: true },
    });
    const currentBalance = balanceAgg._sum.amount ?? 0;

    if (currentBalance < amount) {
      throw new AppError(400, 'INSUFFICIENT_FUNDS', `You do not have enough funds to invest ₹${(amount / 100).toLocaleString()}`);
    }

    // Purchase investment within a database transaction
    return await prisma.$transaction(async (tx) => {
      const currentWeek = state.currentWeek;

      const investment = await tx.investment.create({
        data: {
          profileId,
          productCode: product.productCode,
          type: product.type,
          principalAmount: amount,
          currentValue: amount,
          purchasedAtWeek: currentWeek,
          isActive: true,
        },
      });

      const transaction = await tx.transaction.create({
        data: {
          profileId,
          type: TxType.INVESTMENT,
          category: product.type.toLowerCase(),
          amount: -amount,
          gameWeek: currentWeek,
          description: `Invested in ${product.name}`,
        },
      });

      return {
        investment: {
          id: investment.id,
          productCode: investment.productCode,
          type: investment.type,
          principalAmount: investment.principalAmount,
          currentValue: investment.currentValue,
          purchasedAtWeek: investment.purchasedAtWeek,
          isActive: investment.isActive,
        },
        transaction: {
          id: transaction.id,
          type: transaction.type,
          category: transaction.category,
          amount: transaction.amount,
          gameWeek: transaction.gameWeek,
          description: transaction.description,
        },
      };
    });
  },

  /**
   * Redeems (liquidates) an active investment product.
   */
  async redeem(userId: string, profileId: string, investmentId: string) {
    const profile = await prisma.profile.findUnique({
      where: { id: profileId },
      include: { gameState: true },
    });

    if (!profile || profile.userId !== userId) {
      throw new AppError(404, 'PROFILE_NOT_FOUND', 'Profile not found');
    }

    const state = profile.gameState;
    if (!state || state.status !== 'ACTIVE') {
      throw new AppError(400, 'GAME_INACTIVE', 'Cannot redeem investments in an inactive game');
    }

    const investment = await prisma.investment.findUnique({
      where: { id: investmentId },
    });

    if (!investment || investment.profileId !== profileId || !investment.isActive) {
      throw new AppError(400, 'INVESTMENT_NOT_ACTIVE', 'Investment is not active or does not exist');
    }

    const redemptionValue = investment.currentValue;

    // Process redemption within a transaction
    return await prisma.$transaction(async (tx) => {
      const currentWeek = state.currentWeek;

      // Deactivate investment
      const updatedInv = await tx.investment.update({
        where: { id: investmentId },
        data: { isActive: false },
      });

      // Credit the proceeds back to balance ledger
      const transaction = await tx.transaction.create({
        data: {
          profileId,
          type: TxType.REDEMPTION,
          category: investment.type.toLowerCase(),
          amount: redemptionValue,
          gameWeek: currentWeek,
          description: `Redeemed Investment: ${investment.productCode}`,
        },
      });

      return {
        investment: {
          id: updatedInv.id,
          productCode: updatedInv.productCode,
          type: updatedInv.type,
          principalAmount: updatedInv.principalAmount,
          currentValue: updatedInv.currentValue,
          isActive: updatedInv.isActive,
        },
        transaction: {
          id: transaction.id,
          type: transaction.type,
          category: transaction.category,
          amount: transaction.amount,
          gameWeek: transaction.gameWeek,
          description: transaction.description,
        },
        redemptionValue,
      };
    });
  },
};

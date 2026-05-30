import prisma from '../config/prisma';
import { AppError } from '../middleware/errorHandler';
import { clampWellBeing } from '../domain/game';
import { housingService } from './housingService';

export const investService = {
  async invest(profileId: string, input: { type: string, name?: string, amount: number }) {
    return await prisma.$transaction(async (tx) => {
      const validTypes = ['FD', 'MUTUAL_FUND', 'STOCK', 'COURSE', 'BOOK', 'CERTIFICATION', 'HOUSE', 'LAND'];
      if (!validTypes.includes(input.type)) {
        throw new AppError(400, 'INVALID_INVESTMENT_TYPE', 'Invalid investment type');
      }

      const balanceAgg = await tx.transaction.aggregate({
        where: { profileId },
        _sum: { amount: true }
      });
      const currentBalance = balanceAgg._sum.amount || 0;

      if (currentBalance < input.amount) {
        throw new AppError(400, 'INSUFFICIENT_FUNDS', 'Insufficient funds for investment');
      }

      const profile = await tx.profile.findUnique({ where: { id: profileId }, include: { gameState: true } });
      if (!profile || !profile.gameState) throw new AppError(404, 'PROFILE_NOT_FOUND', 'Profile not found');

      const isFinancial = ['FD', 'MUTUAL_FUND', 'STOCK'].includes(input.type);
      const isSelf = ['COURSE', 'BOOK', 'CERTIFICATION'].includes(input.type);
      const isAsset = ['HOUSE', 'LAND'].includes(input.type);

      const investment = await tx.investment.create({
        data: {
          profileId,
          productCode: `${input.type}_${Date.now()}`,
          type: input.type,
          name: input.name || input.type,
          principalAmount: input.amount,
          currentValue: input.amount,
          purchasedAtWeek: profile.gameState.currentWeek,
          isActive: true
        }
      });

      if (isSelf) {
        let wbBoost = 0;
        if (input.type === 'COURSE') wbBoost = 3;
        if (input.type === 'BOOK') wbBoost = 2;
        if (input.type === 'CERTIFICATION') wbBoost = 5;

        await tx.gameState.update({
          where: { profileId },
          data: {
            selfInvestmentCount: { increment: 1 },
            wellBeing: clampWellBeing(profile.gameState.wellBeing + wbBoost)
          }
        });
      }

      if (input.type === 'HOUSE') {
         await tx.profile.update({
          where: { id: profileId },
          data: { housingStatus: 'OWNED', livingOption: 'FULLY_PAID_HOUSE' }
        });

        await tx.obligation.updateMany({
          where: { profileId, category: { in: ['rent', 'emi'] }, isActive: true, label: { contains: 'HOME' } },
          data: { isActive: false }
        });
        await tx.obligation.updateMany({
          where: { profileId, category: 'rent', isActive: true },
          data: { isActive: false }
        });
        
        await tx.gameState.update({
          where: { profileId },
          data: {
            wellBeing: clampWellBeing(profile.gameState.wellBeing + 4),
            socialScore: Math.min(100, profile.gameState.socialScore + 5)
          }
        });
      }

      await tx.transaction.create({
        data: {
          profileId,
          type: 'DEBIT',
          category: 'investment',
          amount: -input.amount,
          gameWeek: profile.gameState.currentWeek,
          description: `Investment in ${input.type}`
        }
      });

      return investment;
    });
  },

  async applyInvestmentReturns(tx: any, profileId: string, currentWeek: number) {
    const investments = await tx.investment.findMany({ 
      where: { profileId, isActive: true, type: { in: ['FD', 'MUTUAL_FUND', 'STOCK'] } } 
    });

    for (const inv of investments) {
      let annualRate = 0;
      if (inv.type === 'FD') annualRate = 0.04 + Math.random() * 0.03; // 4-7%
      if (inv.type === 'MUTUAL_FUND') annualRate = -0.05 + Math.random() * 0.20; // -5 to +15%
      if (inv.type === 'STOCK') annualRate = -0.20 + Math.random() * 0.45; // -20 to +25%

      const weeklyRate = annualRate / 12 / 4; // Simplified to weekly
      const newValue = Math.round(inv.currentValue * (1 + weeklyRate));

      await tx.investment.update({
        where: { id: inv.id },
        data: { currentValue: newValue }
      });
    }
  },

  async getPortfolio(profileId: string) {
    const investments = await prisma.investment.findMany({ where: { profileId, isActive: true } });
    const grouped = investments.reduce((acc: any, inv) => {
      if (!acc[inv.type]) acc[inv.type] = [];
      acc[inv.type].push(inv);
      return acc;
    }, {});
    return grouped;
  }
};

import prisma from '../config/prisma';
import { AppError } from '../middleware/errorHandler';
import { clampWellBeing, clampSocialScore } from '../domain/game';

export const spendService = {
  async spend(profileId: string, input: { category: string, itemName: string, amount: number }) {
    return await prisma.$transaction(async (tx) => {
      const validCategories = ['GADGET', 'WATCH', 'VACATION', 'DINING', 'ENTERTAINMENT', 'LUXURY'];
      if (!validCategories.includes(input.category)) {
        throw new AppError(400, 'INVALID_SPEND_CATEGORY', 'Invalid spend category');
      }

      const balanceAgg = await tx.transaction.aggregate({
        where: { profileId },
        _sum: { amount: true }
      });
      const currentBalance = balanceAgg._sum.amount || 0;

      if (currentBalance < input.amount) {
        throw new AppError(400, 'INSUFFICIENT_FUNDS', 'Insufficient funds for spend');
      }

      const profile = await tx.profile.findUnique({ where: { id: profileId }, include: { gameState: true } });
      if (!profile || !profile.gameState) throw new AppError(404, 'PROFILE_NOT_FOUND', 'Profile not found');

      let wbBoost = 0;
      let socialBoost = 0;

      // Boost values per spec: gadgets/luxury boost social, vacations/dining boost wellbeing
      switch (input.category) {
        case 'GADGET':        wbBoost = 4;  socialBoost = 10; break;
        case 'WATCH':         wbBoost = 2;  socialBoost = 8;  break;
        case 'VACATION':      wbBoost = 12; socialBoost = 3;  break;
        case 'DINING':        wbBoost = 2;  socialBoost = 1;  break;
        case 'ENTERTAINMENT': wbBoost = 3;  socialBoost = 1;  break;
        case 'LUXURY':        wbBoost = 2;  socialBoost = 6;  break;
      }

      await tx.gameState.update({
        where: { profileId },
        data: {
          wellBeing: clampWellBeing(profile.gameState.wellBeing + wbBoost),
          socialScore: clampSocialScore(profile.gameState.socialScore + socialBoost)
        }
      });

      const transaction = await tx.transaction.create({
        data: {
          profileId,
          type: 'DEBIT',
          category: 'spend',
          amount: -input.amount,
          gameWeek: profile.gameState.currentWeek,
          description: `Spent on ${input.itemName} (${input.category})`
        }
      });

      return transaction;
    });
  }
};

import prisma from '../config/prisma';
import { GAME_CONSTANTS } from '../config/constants';
import { housingService } from './housingService';

export const inflationService = {
  async applyYearlyInflation(tx: any, profileId: string, currentWeek: number) {
    if (currentWeek % 12 !== 0) return null; // Only apply every 12 weeks (yearly in game time)

    const profile = await tx.profile.findUnique({ where: { id: profileId }, include: { gameState: true } });
    if (!profile || !profile.gameState) return null;

    const state = profile.gameState;

    // Generate random inflation rate for general expenses
    const generalInflationRate = GAME_CONSTANTS.INFLATION_MIN_PERCENT / 100 + Math.random() * ((GAME_CONSTANTS.INFLATION_MAX_PERCENT - GAME_CONSTANTS.INFLATION_MIN_PERCENT) / 100);

    // Inflate Food, Transport, Utilities, Insurance, Mobile
    const categoriesToInflate = ['food', 'transport', 'utilities', 'insurance', 'mobile'];
    
    const activeObligations = await tx.obligation.findMany({ 
      where: { profileId, isActive: true, category: { in: categoriesToInflate } } 
    });

    for (const obl of activeObligations) {
      const newAmount = Math.round(obl.amount * (1 + generalInflationRate));
      await tx.obligation.update({
        where: { id: obl.id },
        data: { amount: newAmount }
      });
    }

    // Rent Inflation
    let rentInflationApplied = null;
    if (profile.livingOption === 'INDIVIDUAL_RENT' || profile.livingOption === 'SHARED_RENT') {
      const baseRent = profile.livingOption === 'INDIVIDUAL_RENT' ? GAME_CONSTANTS.BASE_RENT_INDIVIDUAL : GAME_CONSTANTS.BASE_RENT_SHARED;
      const newRent = housingService.computeCurrentRent(baseRent, currentWeek, profile.livingOption);
      
      await tx.gameState.update({
        where: { profileId },
        data: { currentRent: newRent }
      });

      const rentObligation = await tx.obligation.findFirst({
        where: { profileId, category: 'rent', isActive: true }
      });

      if (rentObligation) {
        await tx.obligation.update({
          where: { id: rentObligation.id },
          data: { amount: newRent }
        });
        rentInflationApplied = newRent;
      }
    }

    return { generalInflationRate, rentInflationApplied };
  }
};

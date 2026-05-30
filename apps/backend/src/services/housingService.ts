import prisma from '../config/prisma';
import { AppError } from '../middleware/errorHandler';
import { GAME_CONSTANTS } from '../config/constants';
import { clampCreditScore, clampSocialScore, clampWellBeing } from '../domain/game';

export const housingService = {
  async setLivingOption(profileId: string, livingOption: 'INDIVIDUAL_RENT' | 'SHARED_RENT' | 'HOME_LOAN') {
    return await prisma.$transaction(async (tx) => {
      const profile = await tx.profile.findUnique({ where: { id: profileId }, include: { gameState: true } });
      if (!profile || !profile.gameState) throw new AppError(404, 'PROFILE_NOT_FOUND', 'Profile not found');
      
      if (profile.gameState.currentWeek !== 1) {
        throw new AppError(400, 'GAME_ALREADY_STARTED', 'Living option must be set before advancing the first week');
      }

      if (livingOption === 'HOME_LOAN') {
        const houseCost = 400_000_000; // ₹40L in paise
        const downPayment = 50_000_000; // ₹5L in paise
        const loanAmount = 350_000_000; // ₹35L in paise
        const interestRate = 8.0;
        const tenureMonths = 240;

        const { calculateEmi } = await import('../domain/loan');
        const emiAmount = calculateEmi(loanAmount, interestRate, tenureMonths);

        // Update profile
        const updatedProfile = await tx.profile.update({
          where: { id: profileId },
          data: {
            livingOption: 'FULLY_PAID_HOUSE',
            housingStatus: 'HOME_LOAN',
            hasHomeLoan: true,
          },
        });

        // Set currentRent to 0
        await tx.gameState.update({
          where: { profileId },
          data: { currentRent: 0 },
        });

        // Create down payment debit transaction
        await tx.transaction.create({
          data: {
            profileId,
            type: 'DEBIT',
            category: 'investment',
            amount: -downPayment,
            gameWeek: 1,
            description: 'House Purchase Down Payment (₹5L)',
          },
        });

        // Add House Asset Investment
        await tx.investment.create({
          data: {
            profileId,
            productCode: 'HOUSE',
            type: 'HOUSE',
            name: 'Owned House',
            principalAmount: houseCost,
            currentValue: houseCost,
            purchasedAtWeek: 1,
            isActive: true,
          },
        });

        // Create Home Loan
        await tx.loan.create({
          data: {
            profileId,
            type: 'HOME',
            principalAmount: loanAmount,
            interestRate,
            tenureMonths,
            emiAmount,
            remainingAmount: loanAmount,
            remainingMonths: tenureMonths,
            isActive: true,
          },
        });

        // Add HOME EMI Obligation
        await tx.obligation.create({
          data: {
            profileId,
            label: 'HOME EMI',
            category: 'emi',
            amount: emiAmount,
            isActive: true,
            startWeek: 1,
          },
        });

        // Deactivate existing Rent obligation if any
        await tx.obligation.updateMany({
          where: { profileId, category: 'rent', isActive: true },
          data: { isActive: false },
        });

        return updatedProfile;
      }

      const housingStatus = livingOption === 'INDIVIDUAL_RENT' ? 'RENTING' : 'SHARED_RENT';
      const baseRent = livingOption === 'INDIVIDUAL_RENT' ? GAME_CONSTANTS.BASE_RENT_INDIVIDUAL : GAME_CONSTANTS.BASE_RENT_SHARED;

      // Update profile
      const updatedProfile = await tx.profile.update({
        where: { id: profileId },
        data: { livingOption, housingStatus },
      });

      // Update currentRent in GameState
      await tx.gameState.update({
        where: { profileId },
        data: { currentRent: baseRent },
      });

      // Upsert Rent Obligation
      const existingRentObligation = await tx.obligation.findFirst({
        where: { profileId, category: 'rent' }
      });

      if (existingRentObligation) {
        await tx.obligation.update({
          where: { id: existingRentObligation.id },
          data: { amount: baseRent, label: 'Rent' }
        });
      } else {
        await tx.obligation.create({
          data: { profileId, label: 'Rent', category: 'rent', amount: baseRent, isActive: true, startWeek: 1 }
        });
      }

      return updatedProfile;
    });
  },

  computeCurrentRent(baseRent: number, currentWeek: number, livingOption: string): number {
    const yearsElapsed = Math.floor(currentWeek / 12);
    if (yearsElapsed === 0) return baseRent;

    const inflationRange = livingOption === 'INDIVIDUAL_RENT' 
      ? GAME_CONSTANTS.RENT_INFLATION.INDIVIDUAL_RENT 
      : GAME_CONSTANTS.RENT_INFLATION.SHARED_RENT;

    // Deterministic inflation calculation based on yearsElapsed
    const deterministicSeed = Math.abs(Math.sin(yearsElapsed)); 
    const inflationRate = inflationRange.min + deterministicSeed * (inflationRange.max - inflationRange.min);
    
    return Math.round(baseRent * Math.pow(1 + inflationRate, yearsElapsed));
  },

  getHousingWellBeingEffect(livingOption: string): { wellBeingDelta: number, socialScoreDelta: number } {
    switch (livingOption) {
      case 'INDIVIDUAL_RENT': return { wellBeingDelta: 5, socialScoreDelta: 3 };
      case 'SHARED_RENT': return { wellBeingDelta: -2, socialScoreDelta: 0 };
      case 'FULLY_PAID_HOUSE': return { wellBeingDelta: 4, socialScoreDelta: 5 };
      default: return { wellBeingDelta: 0, socialScoreDelta: 0 }; // HOME_LOAN case
    }
  },

  async transitionToOwned(profileId: string) {
    return await prisma.$transaction(async (tx) => {
      const profile = await tx.profile.update({
        where: { id: profileId },
        data: { housingStatus: 'OWNED', livingOption: 'FULLY_PAID_HOUSE' }
      });

      // Deactivate Rent and HOME EMI Obligations
      await tx.obligation.updateMany({
        where: { profileId, category: { in: ['rent', 'emi'] }, isActive: true, label: { contains: 'HOME' } },
        data: { isActive: false }
      });
      await tx.obligation.updateMany({
        where: { profileId, category: 'rent', isActive: true },
        data: { isActive: false }
      });

      // Apply bonuses
      const effects = this.getHousingWellBeingEffect('FULLY_PAID_HOUSE');
      const state = await tx.gameState.findUnique({ where: { profileId } });
      if (state) {
        await tx.gameState.update({
          where: { profileId },
          data: {
            wellBeing: clampWellBeing(state.wellBeing + effects.wellBeingDelta),
            socialScore: clampSocialScore(state.socialScore + effects.socialScoreDelta)
          }
        });
      }

      return profile;
    });
  },

  async transitionToHomeLoan(profileId: string) {
    return await prisma.$transaction(async (tx) => {
      const profile = await tx.profile.update({
        where: { id: profileId },
        data: { housingStatus: 'HOME_LOAN' }
      });

      await tx.obligation.updateMany({
        where: { profileId, category: 'rent', isActive: true },
        data: { isActive: false }
      });

      return profile;
    });
  }
};

import prisma from '../config/prisma';
import { AppError } from '../middleware/errorHandler';
import { GAME_CONSTANTS } from '../config/constants';
import { 
  calculateEmi, 
  calculateLoanApprovalChance, 
  shouldLoanBeApproved,
  getAdjustedInterestRate,
  getCreditScorePenalty,
  calculateMissedEmiPenalty
} from '../domain/loan';
import { housingService } from './housingService';

export interface LoanApprovalResult {
  approved: boolean;
  approvalChance: number;
  reason?: string;
  loan?: any;
  emiAmount?: number;
}

export const loanService = {
  /**
   * Requests a loan with approval logic.
   * Returns { approved, approvalChance, reason, loan?, emiAmount? }
   */
  async requestLoan(
    profileId: string,
    input: { type: 'HOME' | 'VEHICLE' | 'PERSONAL', amount: number, downPayment?: number }
  ): Promise<LoanApprovalResult> {
    return await prisma.$transaction(async (tx) => {
      const profile = await tx.profile.findUnique({
        where: { id: profileId },
        include: { gameState: true },
      });

      if (!profile || !profile.gameState) {
        throw new AppError(404, 'PROFILE_NOT_FOUND', 'Profile not found');
      }

      // Get defaults from constants
      const defaults = GAME_CONSTANTS.LOAN_DEFAULTS[input.type];
      if (!defaults) {
        throw new AppError(400, 'INVALID_LOAN_TYPE', `Invalid loan type: ${input.type}`);
      }

      const tenureMonths = defaults.tenureMonths;
      const baseInterestRate = defaults.interestRate;

      // Adjust interest rate based on difficulty
      const adjustedInterestRate = getAdjustedInterestRate(baseInterestRate, profile.difficulty as any);

      // Calculate total EMI
      const emiAmount = calculateEmi(input.amount, adjustedInterestRate, tenureMonths);

      // Get existing EMI obligations
      const existingEmis = await tx.obligation.findMany({
        where: { profileId, category: 'emi', isActive: true },
      });
      const totalExistingEmi = existingEmis.reduce((sum, obl) => sum + obl.amount, 0);

      // Calculate approval chance
      const monthlySalary = profile.gameState.salary;
      const approvalChance = calculateLoanApprovalChance(
        profile.gameState.creditScore,
        totalExistingEmi,
        monthlySalary,
        profile.difficulty as any,
        input.type
      );

      // Determine if loan is approved
      const isApproved = shouldLoanBeApproved(approvalChance);

      if (!isApproved) {
        return {
          approved: false,
          approvalChance,
          reason: `Loan rejected. Approval chance was ${(approvalChance * 100).toFixed(0)}%. Check your credit score and existing debt.`,
        };
      }

      // Loan is approved - create it
      const loan = await tx.loan.create({
        data: {
          profileId,
          type: input.type,
          principalAmount: input.amount,
          interestRate: adjustedInterestRate,
          tenureMonths,
          emiAmount,
          remainingAmount: input.amount,
          remainingMonths: tenureMonths,
          isActive: true,
        },
      });

      // Add EMI to obligations (starting next week)
      await tx.obligation.create({
        data: {
          profileId,
          label: `${input.type} EMI`,
          category: 'emi',
          amount: emiAmount,
          isActive: true,
          startWeek: profile.gameState.currentWeek + 1,
        },
      });

      // Update profile based on loan type
      const updateData: any = {};
      if (input.type === 'HOME') {
        updateData.hasHomeLoan = true;
        updateData.housingStatus = 'HOME_LOAN';
      }
      if (input.type === 'VEHICLE') updateData.hasVehicleLoan = true;
      if (input.type === 'PERSONAL') updateData.hasPersonalLoan = true;

      await tx.profile.update({
        where: { id: profileId },
        data: updateData,
      });

      // If HOME loan, deactivate rent obligations
      if (input.type === 'HOME') {
        await tx.obligation.updateMany({
          where: { profileId, category: 'rent', isActive: true },
          data: { isActive: false },
        });
      }

      // Record loan disbursement as credit transaction
      await tx.transaction.create({
        data: {
          profileId,
          type: 'CREDIT',
          category: 'loan',
          amount: input.amount,
          gameWeek: profile.gameState.currentWeek,
          description: `${input.type} Loan Disbursement (Approved at ${(approvalChance * 100).toFixed(0)}%)`,
        },
      });

      // Update credit score slightly for taking loan
      await tx.gameState.update({
        where: { profileId },
        data: {
          creditScore: Math.max(300, profile.gameState.creditScore - 5), // -5 for taking on debt
        },
      });

      return {
        approved: true,
        approvalChance,
        loan,
        emiAmount,
      };
    });
  },

  /**
   * Legacy method - creates loan without approval logic (for compatibility)
   * @deprecated Use requestLoan instead for new code
   */
  async createLoan(profileId: string, input: { type: 'HOME' | 'VEHICLE' | 'PERSONAL', amount: number, tenureMonths?: number, interestRate?: number }) {
    return await prisma.$transaction(async (tx) => {
      const defaults = GAME_CONSTANTS.LOAN_DEFAULTS[input.type];
      const tenureMonths = input.tenureMonths || defaults.tenureMonths;
      const interestRate = input.interestRate || defaults.interestRate;

      const emiAmount = calculateEmi(input.amount, interestRate, tenureMonths);

      const loan = await tx.loan.create({
        data: {
          profileId,
          type: input.type,
          principalAmount: input.amount,
          interestRate,
          tenureMonths,
          emiAmount,
          remainingAmount: input.amount,
          remainingMonths: tenureMonths,
          isActive: true
        }
      });

      const profile = await tx.profile.findUnique({ where: { id: profileId }, include: { gameState: true } });
      if (!profile || !profile.gameState) throw new AppError(404, 'PROFILE_NOT_FOUND', 'Profile not found');

      await tx.obligation.create({
        data: {
          profileId,
          label: `${input.type} EMI`,
          category: 'emi',
          amount: emiAmount,
          isActive: true,
          startWeek: profile.gameState.currentWeek + 1
        }
      });

      const updateData: any = {};
      if (input.type === 'HOME') updateData.hasHomeLoan = true;
      if (input.type === 'VEHICLE') updateData.hasVehicleLoan = true;
      if (input.type === 'PERSONAL') updateData.hasPersonalLoan = true;

      await tx.profile.update({
        where: { id: profileId },
        data: updateData
      });

      if (input.type === 'HOME') {
        await tx.profile.update({
          where: { id: profileId },
          data: { housingStatus: 'HOME_LOAN' }
        });
        await tx.obligation.updateMany({
          where: { profileId, category: 'rent', isActive: true },
          data: { isActive: false }
        });
      }

      await tx.transaction.create({
        data: {
          profileId,
          type: 'CREDIT',
          category: 'loan',
          amount: input.amount,
          gameWeek: profile.gameState.currentWeek,
          description: `${input.type} Loan Disbursement`
        }
      });

      return { loan, emiAmount };
    });
  },

  async processEmiPayment(tx: any, profileId: string, gameWeek: number) {
    const activeLoans = await tx.loan.findMany({ where: { profileId, isActive: true } });
    
    for (const loan of activeLoans) {
      await tx.transaction.create({
        data: {
          profileId,
          type: 'DEBIT',
          category: 'emi',
          amount: -loan.emiAmount,
          gameWeek,
          description: `EMI Payment: ${loan.type}`
        }
      });

      const remainingMonths = loan.remainingMonths - 1;
      const principalPortion = loan.emiAmount; // simplified remaining principal calculation
      const remainingAmount = Math.max(0, loan.remainingAmount - principalPortion);

      if (remainingMonths <= 0 || remainingAmount <= 0) {
        await tx.loan.update({
          where: { id: loan.id },
          data: { remainingMonths: 0, remainingAmount: 0, isActive: false }
        });

        await tx.obligation.updateMany({
          where: { profileId, label: `${loan.type} EMI`, isActive: true },
          data: { isActive: false }
        });

        if (loan.type === 'HOME') {
           await tx.profile.update({
            where: { id: profileId },
            data: { housingStatus: 'OWNED', livingOption: 'FULLY_PAID_HOUSE' }
          });
        }
      } else {
        await tx.loan.update({
          where: { id: loan.id },
          data: { remainingMonths, remainingAmount }
        });
      }
    }
  },

  getMissedEmiPenalty(loan: any): { creditScoreDelta: number, wellBeingDelta: number } {
    return { creditScoreDelta: -50, wellBeingDelta: -10 };
  }
};

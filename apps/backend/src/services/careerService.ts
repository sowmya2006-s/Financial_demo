import prisma from '../config/prisma';
import { clampWellBeing, clampSocialScore } from '../domain/game';

const CAREER_LADDER: Record<string, string> = {
  'Junior Developer': 'Software Engineer',
  'Software Engineer': 'Senior Engineer',
  'Senior Engineer': 'Lead Engineer',
  'Lead Engineer': 'Engineering Manager',
  'Data Analyst': 'Senior Analyst',
  'Senior Analyst': 'Analytics Manager',
  'Analytics Manager': 'Director of Analytics',
  'Junior Designer': 'UI/UX Designer',
  'UI/UX Designer': 'Senior Designer',
  'Senior Designer': 'Design Lead',
  'Marketing Associate': 'Marketing Manager',
  'Marketing Manager': 'Senior Marketing Manager',
  'Accountant': 'Senior Accountant',
  'Senior Accountant': 'Finance Manager',
  'Finance Manager': 'CFO',
};

export const careerService = {
  async checkPromotion(tx: any, profileId: string) {
    const profile = await tx.profile.findUnique({ where: { id: profileId }, include: { gameState: true } });
    if (!profile || !profile.gameState) return null;

    const state = profile.gameState;

    const balanceAgg = await tx.transaction.aggregate({
      where: { profileId },
      _sum: { amount: true }
    });
    const netBalance = balanceAgg._sum.amount || 0;

    const financialStabilityScore = netBalance > 0 ? Math.min(100, (netBalance / 100000) * 100) : 0;
    
    // Calculate promotionScore = wellBeing * 0.4 + (selfInvestmentCount * 10, capped at 100) * 0.35 + workConsistencyScore * 0.15 + financialStabilityScore * 0.10
    const selfInvestScore = Math.min(100, state.selfInvestmentCount * 10);
    const promotionScore = (state.wellBeing * 0.4) + (selfInvestScore * 0.35) + (state.workConsistencyScore * 0.15) + (financialStabilityScore * 0.10);

    if (promotionScore > 70 && state.selfInvestmentCount >= 1) {
      // Promotion triggers
      const increasePercent = 0.05 + Math.random() * 0.10; // 5-15%
      const newSalary = Math.round(state.salary * (1 + increasePercent));

      const newTitle = CAREER_LADDER[profile.career] || `${profile.career} (Senior)`;

      await tx.profile.update({
        where: { id: profileId },
        data: { career: newTitle }
      });

      await tx.gameState.update({
        where: { profileId },
        data: {
          salary: newSalary,
          socialScore: clampSocialScore(state.socialScore + 5),
          wellBeing: clampWellBeing(state.wellBeing + 3),
          selfInvestmentCount: 0 // Reset after promotion
        }
      });

      return {
        oldTitle: profile.career,
        newTitle,
        oldSalary: state.salary,
        newSalary
      };
    }

    return null;
  }
};

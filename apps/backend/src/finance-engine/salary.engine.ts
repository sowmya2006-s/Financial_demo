import { Prisma } from '@prisma/client';

export const SalaryEngine = {
  getSalaryCreditTx(profileId: string, salary: number, week: number) {
    return {
      profileId,
      type: 'CREDIT' as const,
      category: 'SALARY',
      amount: salary,
      gameWeek: week,
      description: 'Weekly salary credit',
    };
  }
};

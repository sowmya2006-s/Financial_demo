function getDeterministicFactor(seedStr: string): number {
  let hash = 0;
  for (let i = 0; i < seedStr.length; i++) {
    hash = seedStr.charCodeAt(i) + ((hash << 5) - hash);
  }
  return Math.abs(Math.sin(hash)) % 1;
}

export const InvestmentEngine = {
  calculateReturnRate(params: {
    type: 'FD' | 'MUTUAL_FUND' | 'STOCK';
    difficulty: string;
    gameWeek: number;
    investmentId: string;
  }): number {
    const { type, difficulty, gameWeek, investmentId } = params;
    const seed = `${investmentId}_week_${gameWeek}`;
    const factor = getDeterministicFactor(seed);

    if (type === 'FD') {
      // 4% to 7%
      return 0.04 + factor * 0.03;
    }

    if (type === 'MUTUAL_FUND') {
      // -5% to +15%
      return -0.05 + factor * 0.20;
    }

    // STOCK
    // Standard/Beginner: -20% to +25%
    // Hard: -30% to +25%
    const minReturn = difficulty === 'HARD' ? -0.30 : -0.20;
    const maxReturn = 0.25;
    return minReturn + factor * (maxReturn - minReturn);
  },

  getSelfInvestmentEffects(type: 'BOOK' | 'COURSE' | 'CERTIFICATION') {
    switch (type) {
      case 'BOOK':
        return {
          promotionChance: 2,
          wellBeing: 1,
          skillGrowth: 1
        };
      case 'COURSE':
        return {
          promotionChance: 5,
          careerGrowth: 4,
          salaryMultiplier: 1.02 // +2% salary increase multiplier
        };
      case 'CERTIFICATION':
        return {
          promotionChance: 8,
          careerGrowth: 6,
          salaryMultiplier: 1.05 // +5% salary increase multiplier
        };
    }
  }
};

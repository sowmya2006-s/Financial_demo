export const BankruptcyEngine = {
  checkBankruptcy(params: {
    netWorthPaise: number;
    consecutiveNegativeWeeks: number;
  }): { isBankrupt: boolean; reason?: string } {
    const { netWorthPaise, consecutiveNegativeWeeks } = params;

    // Thresholds
    const CONSECUTIVE_NEGATIVE_WEEKS_LIMIT = 3;
    const NET_WORTH_BANKRUPTCY_THRESHOLD = -5_000_000; // -₹50,000

    if (consecutiveNegativeWeeks >= CONSECUTIVE_NEGATIVE_WEEKS_LIMIT) {
      return {
        isBankrupt: true,
        reason: 'Liquid balance remained negative for 3 consecutive weeks.'
      };
    }

    if (netWorthPaise < NET_WORTH_BANKRUPTCY_THRESHOLD) {
      return {
        isBankrupt: true,
        reason: `Net worth fell below the bankruptcy threshold of -₹50,000.`
      };
    }

    return { isBankrupt: false };
  }
};

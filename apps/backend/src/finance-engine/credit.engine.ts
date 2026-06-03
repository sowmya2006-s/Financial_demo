export const CreditEngine = {
  calculateCreditScore(params: {
    currentScore: number;
    missedBillsCount: number;
    missedEmisCount: number;
    allPaid: boolean;
  }): { newScore: number; delta: number } {
    const { currentScore, missedBillsCount, missedEmisCount, allPaid } = params;
    let delta = 0;

    if (allPaid) {
      delta += 10; // +10 on-time payment
    } else {
      delta -= missedBillsCount * 30; // -30 per missed bill
    }

    delta -= missedEmisCount * 50; // -50 per missed EMI (heavier penalty)

    // Clamp score between 300 and 900
    const newScore = Math.min(900, Math.max(300, currentScore + delta));
    return { newScore, delta: newScore - currentScore };
  }
};

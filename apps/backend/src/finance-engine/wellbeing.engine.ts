export const WellbeingEngine = {
  calculateWellbeing(params: {
    currentWellbeing: number;
    salaryPaise: number;
    mandatoryBillsTotalPaise: number;
    missedBillsCount: number;
    missedEmisCount: number;
  }): { newWellbeing: number; delta: number; stressTriggered: boolean } {
    const { currentWellbeing, salaryPaise, mandatoryBillsTotalPaise, missedBillsCount, missedEmisCount } = params;
    let delta = 0;

    // Stress rule: bills > 60% salary
    const stressRatio = salaryPaise > 0 ? mandatoryBillsTotalPaise / salaryPaise : 0;
    const stressTriggered = stressRatio > 0.60;

    if (stressTriggered) {
      delta -= 10;
    }

    if (missedBillsCount > 0 || missedEmisCount > 0) {
      delta -= 10; // penalty for missed payments
    }

    const newWellbeing = Math.min(100, Math.max(0, currentWellbeing + delta));
    return { newWellbeing, delta: newWellbeing - currentWellbeing, stressTriggered };
  }
};

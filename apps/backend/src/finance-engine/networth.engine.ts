export const NetWorthEngine = {
  calculateNetWorth(params: {
    liquidBalance: number;
    investmentsValue: number;
    housingAssetsValue: number;
    loansRemainingAmount: number;
  }): number {
    const assets = params.liquidBalance + params.investmentsValue + params.housingAssetsValue;
    const liabilities = params.loansRemainingAmount;
    return assets - liabilities;
  }
};

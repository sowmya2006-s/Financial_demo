import { GAME_CONSTANTS } from '../config/constants';

function deterministicAmount(min: number, max: number, seed: number): number {
  const range = max - min;
  if (range <= 0) return min;
  const t = Math.abs(Math.sin(seed * 7919)) % 1;
  return Math.round(min + t * range);
}

export const BillingEngine = {
  computeIncomeTax(salaryPaise: number): number {
    // salary < 30000 = 0%
    // 30000–60000 = 5%
    // 60000–100000 = 10%
    // 100000+ = 20%
    // Values in paise (1 INR = 100 paise)
    if (salaryPaise < 3_000_000) return 0;
    if (salaryPaise <= 6_000_000) return Math.round(salaryPaise * 0.05);
    if (salaryPaise <= 10_000_000) return Math.round(salaryPaise * 0.10);
    return Math.round(salaryPaise * 0.20);
  },

  generateWeeklyBills(params: {
    salaryPaise: number;
    gameWeek: number;
    difficulty: string;
    socialScore: number;
    hasVehicle: boolean;
    activeHousingAsset?: { type: 'HOSTEL' | 'RENT' | 'BUY'; monthlyExpense: number } | null;
  }) {
    const { salaryPaise, gameWeek, difficulty, socialScore, hasVehicle, activeHousingAsset } = params;
    
    // Difficulty Multiplier
    const multipliers: Record<string, number> = {
      BEGINNER: 0.85,
      STANDARD: 1.00,
      HARD: 1.20
    };
    const multiplier = multipliers[difficulty] ?? 1.0;

    const bills: Array<{ billName: string; category: string; amount: number }> = [];

    // 1. Income Tax
    const tax = this.computeIncomeTax(salaryPaise);
    if (tax > 0) {
      bills.push({ billName: 'Income Tax', category: 'tax', amount: tax });
    }

    // 2. Food & Groceries (₹4,000 - ₹7,000)
    // Higher salary/social score pushes cost slightly higher within range
    const foodMin = 400_000;
    const foodMax = 700_000;
    const salaryFactor = Math.min(1, salaryPaise / 10_000_000);
    const socialFactor = Math.min(1, socialScore / 100);
    const biasFactor = (salaryFactor + socialFactor) / 2;
    const biasedMax = Math.round(foodMin + biasFactor * (foodMax - foodMin));
    const baseFood = deterministicAmount(foodMin, biasedMax, gameWeek * 3 + 1);
    bills.push({
      billName: 'Food & Groceries',
      category: 'food',
      amount: Math.round(baseFood * multiplier)
    });

    // 3. Transport (₹1,500 - ₹4,000)
    // Vehicle owners pay more
    const transportMin = 150_000;
    const transportMax = 400_000;
    const effectiveMin = hasVehicle ? Math.round((transportMin + transportMax) / 2) : transportMin;
    const effectiveMax = hasVehicle ? transportMax : Math.round((transportMin + transportMax) / 2);
    const baseTransport = deterministicAmount(effectiveMin, effectiveMax, gameWeek * 5 + 2);
    bills.push({
      billName: 'Transport',
      category: 'transport',
      amount: Math.round(baseTransport * multiplier)
    });

    // 4. Mobile Recharge (₹300 - ₹800)
    const mobileMin = 30_000;
    const mobileMax = 80_000;
    const baseMobile = deterministicAmount(mobileMin, mobileMax, gameWeek * 11 + 3);
    bills.push({
      billName: 'Mobile Recharge',
      category: 'mobile',
      amount: Math.round(baseMobile * multiplier)
    });

    // 5. Housing Cost
    if (activeHousingAsset) {
      if (activeHousingAsset.type === 'RENT') {
        bills.push({
          billName: 'Rent',
          category: 'rent',
          amount: activeHousingAsset.monthlyExpense // already set on transition
        });
      } else if (activeHousingAsset.type === 'HOSTEL') {
        bills.push({
          billName: 'Hostel Rent',
          category: 'rent',
          amount: activeHousingAsset.monthlyExpense
        });
      }
      // BUY type has no rental housing bill (only EMI under loans)
    }

    // 6. Utility Bills (Week 2+)
    if (gameWeek >= 2) {
      // Electricity: ₹800 - ₹2,000
      const electricity = deterministicAmount(80_000, 200_000, gameWeek * 13 + 4);
      bills.push({
        billName: 'Electricity',
        category: 'utilities',
        amount: Math.round(electricity * multiplier)
      });

      // Water: ₹300 - ₹800
      const water = deterministicAmount(30_000, 80_000, gameWeek * 17 + 5);
      bills.push({
        billName: 'Water',
        category: 'utilities',
        amount: Math.round(water * multiplier)
      });

      // Internet: ₹700 - ₹1,500
      const internet = deterministicAmount(70_000, 150_000, gameWeek * 19 + 6);
      bills.push({
        billName: 'Internet',
        category: 'utilities',
        amount: Math.round(internet * multiplier)
      });
    }

    return bills;
  }
};

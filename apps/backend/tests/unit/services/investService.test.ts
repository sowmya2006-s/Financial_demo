// tests/unit/services/investService.test.ts
import { investService } from '../../../src/services/investService';
import { AppError } from '../../../src/middleware/errorHandler';
import prisma from '../../../src/config/prisma';

jest.mock('../../../src/config/prisma', () => {
  return {
    __esModule: true,
    default: {
      $transaction: jest.fn(),
      investment: {
        findMany: jest.fn(),
      },
    },
  };
});

describe('investService.invest', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('successfully purchases an investment when funds are sufficient', async () => {
    const mockTx = {
      transaction: {
        aggregate: jest.fn().mockResolvedValue({ _sum: { amount: 100000 } }),
        create: jest.fn().mockResolvedValue({ id: 'tx-id-invest' }),
      },
      profile: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'profile-id',
          gameState: {
            wellBeing: 50,
            currentWeek: 2,
          },
        }),
      },
      investment: {
        create: jest.fn().mockResolvedValue({ id: 'inv-id-1', type: 'FD' }),
      },
    };

    (prisma.$transaction as jest.Mock).mockImplementation(async (callback) => {
      return callback(mockTx);
    });

    const result = await investService.invest('profile-id', {
      type: 'FD',
      amount: 10000,
      name: 'Fixed Deposit 6M',
    });

    expect(mockTx.transaction.aggregate).toHaveBeenCalledWith({
      where: { profileId: 'profile-id' },
      _sum: { amount: true },
    });
    expect(mockTx.investment.create).toHaveBeenCalledWith({
      data: {
        profileId: 'profile-id',
        productCode: expect.stringMatching(/^FD_/),
        type: 'FD',
        name: 'Fixed Deposit 6M',
        principalAmount: 10000,
        currentValue: 10000,
        purchasedAtWeek: 2,
        isActive: true,
      },
    });
    expect(mockTx.transaction.create).toHaveBeenCalledWith({
      data: {
        profileId: 'profile-id',
        type: 'DEBIT',
        category: 'investment',
        amount: -10000,
        gameWeek: 2,
        description: 'Investment in FD',
      },
    });
    expect(result).toEqual({ id: 'inv-id-1', type: 'FD' });
  });

  it('handles self-investments and boosts wellbeing', async () => {
    const mockTx = {
      transaction: {
        aggregate: jest.fn().mockResolvedValue({ _sum: { amount: 50000 } }),
        create: jest.fn().mockResolvedValue({}),
      },
      profile: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'profile-id',
          gameState: {
            wellBeing: 50,
            currentWeek: 2,
          },
        }),
      },
      investment: {
        create: jest.fn().mockResolvedValue({ id: 'inv-id-course', type: 'COURSE' }),
      },
      gameState: {
        update: jest.fn().mockResolvedValue({}),
      },
    };

    (prisma.$transaction as jest.Mock).mockImplementation(async (callback) => {
      return callback(mockTx);
    });

    await investService.invest('profile-id', {
      type: 'COURSE',
      amount: 2000,
    });

    expect(mockTx.gameState.update).toHaveBeenCalledWith({
      where: { profileId: 'profile-id' },
      data: {
        selfInvestmentCount: { increment: 1 },
        wellBeing: 53, // 50 + 3 for COURSE
      },
    });
  });

  it('handles HOUSE investments (deactivates rent and obligation EMIs)', async () => {
    const mockTx = {
      transaction: {
        aggregate: jest.fn().mockResolvedValue({ _sum: { amount: 1000000 } }),
        create: jest.fn().mockResolvedValue({}),
      },
      profile: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'profile-id',
          gameState: {
            wellBeing: 50,
            socialScore: 50,
            currentWeek: 2,
          },
        }),
        update: jest.fn().mockResolvedValue({}),
      },
      investment: {
        create: jest.fn().mockResolvedValue({ id: 'inv-id-house', type: 'HOUSE' }),
      },
      obligation: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      gameState: {
        update: jest.fn().mockResolvedValue({}),
      },
    };

    (prisma.$transaction as jest.Mock).mockImplementation(async (callback) => {
      return callback(mockTx);
    });

    await investService.invest('profile-id', {
      type: 'HOUSE',
      amount: 500000,
    });

    expect(mockTx.profile.update).toHaveBeenCalledWith({
      where: { id: 'profile-id' },
      data: { housingStatus: 'OWNED', livingOption: 'FULLY_PAID_HOUSE' },
    });
    expect(mockTx.obligation.updateMany).toHaveBeenNthCalledWith(1, {
      where: { profileId: 'profile-id', category: { in: ['rent', 'emi'] }, isActive: true, label: { contains: 'HOME' } },
      data: { isActive: false },
    });
    expect(mockTx.obligation.updateMany).toHaveBeenNthCalledWith(2, {
      where: { profileId: 'profile-id', category: 'rent', isActive: true },
      data: { isActive: false },
    });
    expect(mockTx.gameState.update).toHaveBeenCalledWith({
      where: { profileId: 'profile-id' },
      data: {
        wellBeing: 54, // 50 + 4
        socialScore: 55, // 50 + 5
      },
    });
  });

  it('throws AppError 400 for invalid investment type', async () => {
    const mockTx = {};
    (prisma.$transaction as jest.Mock).mockImplementation(async (callback) => {
      return callback(mockTx);
    });

    await expect(
      investService.invest('profile-id', {
        type: 'INVALID_TYPE',
        amount: 5000,
      })
    ).rejects.toThrow(new AppError(400, 'INVALID_INVESTMENT_TYPE', 'Invalid investment type'));
  });

  it('throws AppError 400 when funds are insufficient for investment', async () => {
    const mockTx = {
      transaction: {
        aggregate: jest.fn().mockResolvedValue({ _sum: { amount: 1000 } }),
      },
    };

    (prisma.$transaction as jest.Mock).mockImplementation(async (callback) => {
      return callback(mockTx);
    });

    await expect(
      investService.invest('profile-id', {
        type: 'FD',
        amount: 5000,
      })
    ).rejects.toThrow(new AppError(400, 'INSUFFICIENT_FUNDS', 'Insufficient funds for investment'));
  });
});

describe('investService.applyInvestmentReturns', () => {
  it('correctly updates investment value based on rate of return', async () => {
    const mockTx = {
      investment: {
        findMany: jest.fn().mockResolvedValue([
          { id: 'inv-1', type: 'FD', currentValue: 10000 },
        ]),
        update: jest.fn().mockResolvedValue({}),
      },
    };

    // Math.random stub to return 0 to make return rate deterministic
    const mathRandomSpy = jest.spyOn(Math, 'random').mockReturnValue(0);

    await investService.applyInvestmentReturns(mockTx, 'profile-id', 2);

    expect(mockTx.investment.findMany).toHaveBeenCalledWith({
      where: { profileId: 'profile-id', isActive: true, type: { in: ['FD', 'MUTUAL_FUND', 'STOCK'] } },
    });
    // For FD with Math.random() = 0, annualRate = 0.04. weeklyRate = 0.04 / 12 / 4 = 0.04 / 48 = 0.0008333333333333334
    // newValue = Math.round(10000 * (1 + 0.00083333333)) = Math.round(10008.333) = 10008
    expect(mockTx.investment.update).toHaveBeenCalledWith({
      where: { id: 'inv-1' },
      data: { currentValue: 10008 },
    });

    mathRandomSpy.mockRestore();
  });
});

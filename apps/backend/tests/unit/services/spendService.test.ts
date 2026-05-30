// tests/unit/services/spendService.test.ts
import { spendService } from '../../../src/services/spendService';
import { AppError } from '../../../src/middleware/errorHandler';
import prisma from '../../../src/config/prisma';

jest.mock('../../../src/config/prisma', () => {
  const actualPrisma = jest.requireActual('../../../src/config/prisma');
  return {
    __esModule: true,
    default: {
      $transaction: jest.fn(),
    },
  };
});

describe('spendService.spend', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('successfully processes a valid spend when funds are sufficient', async () => {
    const mockTx = {
      transaction: {
        aggregate: jest.fn().mockResolvedValue({ _sum: { amount: 50000 } }),
        create: jest.fn().mockResolvedValue({ id: 'tx-id-spend', amount: -5000 }),
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
      },
      gameState: {
        update: jest.fn().mockResolvedValue({}),
      },
    };

    (prisma.$transaction as jest.Mock).mockImplementation(async (callback) => {
      return callback(mockTx);
    });

    const result = await spendService.spend('profile-id', {
      category: 'GADGET',
      itemName: 'Smart Watch',
      amount: 5000,
    });

    expect(mockTx.transaction.aggregate).toHaveBeenCalledWith({
      where: { profileId: 'profile-id' },
      _sum: { amount: true },
    });
    expect(mockTx.gameState.update).toHaveBeenCalledWith({
      where: { profileId: 'profile-id' },
      data: {
        wellBeing: 54, // 50 + 4 (GADGET boost)
        socialScore: 60, // 50 + 10 (GADGET boost)
      },
    });
    expect(mockTx.transaction.create).toHaveBeenCalledWith({
      data: {
        profileId: 'profile-id',
        type: 'DEBIT',
        category: 'spend',
        amount: -5000,
        gameWeek: 2,
        description: 'Spent on Smart Watch (GADGET)',
      },
    });
    expect(result).toEqual({ id: 'tx-id-spend', amount: -5000 });
  });

  it('throws AppError 400 for invalid spend category', async () => {
    const mockTx = {};
    (prisma.$transaction as jest.Mock).mockImplementation(async (callback) => {
      return callback(mockTx);
    });

    await expect(
      spendService.spend('profile-id', {
        category: 'INVALID_CAT',
        itemName: 'Banned Item',
        amount: 1000,
      })
    ).rejects.toThrow(new AppError(400, 'INVALID_SPEND_CATEGORY', 'Invalid spend category'));
  });

  it('throws AppError 400 when funds are insufficient', async () => {
    const mockTx = {
      transaction: {
        aggregate: jest.fn().mockResolvedValue({ _sum: { amount: 1000 } }),
      },
    };

    (prisma.$transaction as jest.Mock).mockImplementation(async (callback) => {
      return callback(mockTx);
    });

    await expect(
      spendService.spend('profile-id', {
        category: 'GADGET',
        itemName: 'Expensive Gadget',
        amount: 5000,
      })
    ).rejects.toThrow(new AppError(400, 'INSUFFICIENT_FUNDS', 'Insufficient funds for spend'));
  });
});

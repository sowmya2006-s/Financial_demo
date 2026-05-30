// tests/unit/domain/weeklyEngine.test.ts
import { creditSalary, applyObligations } from '../../../src/domain/weeklyEngine';

describe('weeklyEngine domain functions', () => {
  describe('creditSalary', () => {
    it('should create a CREDIT transaction with the exact salary amount', async () => {
      const mockTx = {
        transaction: {
          create: jest.fn().mockResolvedValue({ id: 'tx-1' }),
        },
      };

      const gameState = {
        profileId: 'profile-id-123',
        salary: 300000, // stored in paise (₹3,000)
        currentWeek: 3,
      } as any;

      await creditSalary(mockTx as any, gameState);

      expect(mockTx.transaction.create).toHaveBeenCalledWith({
        data: {
          profileId: 'profile-id-123',
          type: 'CREDIT',
          category: 'SALARY',
          amount: 300000,
          gameWeek: 3,
          description: 'Weekly salary credit',
        },
      });
    });
  });

  describe('applyObligations', () => {
    it('should filter active obligations and apply them as negative DEBIT transactions', async () => {
      const mockTx = {
        transaction: {
          create: jest.fn().mockResolvedValue({ id: 'tx-obl' }),
        },
      };

      const gameState = {
        profileId: 'profile-id-123',
        currentWeek: 2,
      } as any;

      const obligations = [
        {
          id: 'obl-1',
          label: 'Rent',
          category: 'rent',
          amount: 50000, // ₹500
          startWeek: null,
          isActive: true,
        },
        {
          id: 'obl-2',
          label: 'Vehicle EMI',
          category: 'emi',
          amount: 20000, // ₹200
          startWeek: 1,
          isActive: true,
        },
        {
          id: 'obl-3',
          label: 'Personal EMI',
          category: 'emi',
          amount: 15000, // ₹150
          startWeek: 3, // should be skipped since currentWeek is 2
          isActive: true,
        },
      ] as any[];

      await applyObligations(mockTx as any, gameState, obligations);

      expect(mockTx.transaction.create).toHaveBeenCalledTimes(2);

      expect(mockTx.transaction.create).toHaveBeenNthCalledWith(1, {
        data: {
          profileId: 'profile-id-123',
          type: 'DEBIT',
          category: 'Rent',
          amount: -50000,
          gameWeek: 2,
          description: 'Obligation: Rent',
        },
      });

      expect(mockTx.transaction.create).toHaveBeenNthCalledWith(2, {
        data: {
          profileId: 'profile-id-123',
          type: 'DEBIT',
          category: 'Vehicle EMI',
          amount: -20000,
          gameWeek: 2,
          description: 'Obligation: Vehicle EMI',
        },
      });
    });
  });
});

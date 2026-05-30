// tests/unit/services/profileService.test.ts
// Tests for profileService business logic.
// Repositories and Prisma are mocked so tests remain fast and DB-free.

import { Difficulty } from '../../../src/types/enums';
import { profileService } from '../../../src/services/profileService';
import { profileRepository } from '../../../src/repositories/profileRepository';
import { cohortRepository } from '../../../src/repositories/cohortRepository';

// ─── Mocks ───────────────────────────────────────────────────────────────────

jest.mock('../../../src/repositories/profileRepository');
jest.mock('../../../src/repositories/cohortRepository');
jest.mock('../../../src/config/prisma', () => ({
  __esModule: true,
  default: {
    $transaction: jest.fn(async (fn: (tx: unknown) => Promise<unknown>) => {
      // Execute the transaction callback with a mock tx object
      const mockTx = {
        profile: {
          create: jest.fn().mockResolvedValue(mockProfile),
        },
        obligation: {
          createMany: jest.fn().mockResolvedValue({ count: 2 }),
        },
        gameState: {
          create: jest.fn().mockResolvedValue({}),
        },
        transaction: {
          create: jest.fn().mockResolvedValue({}),
        },
      };
      return fn(mockTx);
    }),
  },
}));

const mockProfileRepo = profileRepository as jest.Mocked<typeof profileRepository>;
const mockCohortRepo = cohortRepository as jest.Mocked<typeof cohortRepository>;

// ─── Test Data ────────────────────────────────────────────────────────────────

const mockCohort = {
  id: 'cohort-uuid-abc',
  weekKey: '2025-W10',
  startedAt: new Date(),
};

const mockProfile = {
  id: 'profile-uuid-xyz',
  userId: 'user-uuid-123',
  cohortId: 'cohort-uuid-abc',
  name: 'Test Profile',
  difficulty: Difficulty.BEGINNER,
  createdAt: new Date(),
  updatedAt: new Date(),
};

// ─── createProfile Tests ──────────────────────────────────────────────────────

describe('profileService.createProfile', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCohortRepo.findOrCreate.mockResolvedValue(mockCohort);
    mockProfileRepo.countByUserAndDifficulty.mockResolvedValue(0);
  });

  it('creates a profile when all inputs are valid and limit not reached', async () => {
    const result = await profileService.createProfile('user-uuid-123', {
      name: 'Test Profile',
      difficulty: Difficulty.BEGINNER,
      age: 22,
    });

    expect(result).toMatchObject({
      id: mockProfile.id,
      name: mockProfile.name,
      difficulty: Difficulty.BEGINNER,
      cohortId: mockCohort.id,
    });
  });

  it('assigns a cohort based on the current ISO week', async () => {
    await profileService.createProfile('user-uuid-123', {
      name: 'Test',
      difficulty: Difficulty.BEGINNER,
      age: 22,
    });

    expect(mockCohortRepo.findOrCreate).toHaveBeenCalledTimes(1);
    // weekKey should match the YYYY-Www format
    const weekKeyArg = mockCohortRepo.findOrCreate.mock.calls[0]![0];
    expect(weekKeyArg).toMatch(/^\d{4}-W\d{2}$/);
  });

  it('throws 409 when STANDARD profile limit (1) is reached', async () => {
    mockProfileRepo.countByUserAndDifficulty.mockResolvedValue(1);

    await expect(
      profileService.createProfile('user-uuid-123', {
        name: 'Another Standard',
        difficulty: Difficulty.STANDARD,
        age: 22,
      }),
    ).rejects.toMatchObject({ statusCode: 409, code: 'PROFILE_LIMIT_REACHED' });
  });

  it('throws 409 when HARD profile limit (1) is reached', async () => {
    mockProfileRepo.countByUserAndDifficulty.mockResolvedValue(1);

    await expect(
      profileService.createProfile('user-uuid-123', {
        name: 'Another Hard',
        difficulty: Difficulty.HARD,
        age: 22,
      }),
    ).rejects.toMatchObject({ statusCode: 409, code: 'PROFILE_LIMIT_REACHED' });
  });

  it('allows up to 5 BEGINNER profiles', async () => {
    mockProfileRepo.countByUserAndDifficulty.mockResolvedValue(4);

    await expect(
      profileService.createProfile('user-uuid-123', {
        name: 'Fifth Profile',
        difficulty: Difficulty.BEGINNER,
        age: 22,
      }),
    ).resolves.toBeDefined();
  });

  it('blocks the 6th BEGINNER profile', async () => {
    mockProfileRepo.countByUserAndDifficulty.mockResolvedValue(5);

    await expect(
      profileService.createProfile('user-uuid-123', {
        name: 'Sixth Profile',
        difficulty: Difficulty.BEGINNER,
        age: 22,
      }),
    ).rejects.toMatchObject({ statusCode: 409, code: 'PROFILE_LIMIT_REACHED' });
  });

  it('throws 400 for invalid profile name', async () => {
    await expect(
      profileService.createProfile('user-uuid-123', {
        name: '',
        difficulty: Difficulty.BEGINNER,
        age: 22,
      }),
    ).rejects.toMatchObject({ statusCode: 400, code: 'VALIDATION_ERROR' });
  });

  it('throws 400 for invalid difficulty', async () => {
    await expect(
      profileService.createProfile('user-uuid-123', {
        name: 'Valid Name',
        difficulty: 'INVALID' as Difficulty,
        age: 22,
      }),
    ).rejects.toMatchObject({ statusCode: 400, code: 'VALIDATION_ERROR' });
  });
});

// ─── getProfile Tests ─────────────────────────────────────────────────────────

describe('profileService.getProfile', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns the profile when it belongs to the requesting user', async () => {
    mockProfileRepo.findById.mockResolvedValue(mockProfile as never);

    const result = await profileService.getProfile('user-uuid-123', 'profile-uuid-xyz');
    expect(result.id).toBe('profile-uuid-xyz');
  });

  it('throws 404 when profile does not exist', async () => {
    mockProfileRepo.findById.mockResolvedValue(null);

    await expect(
      profileService.getProfile('user-uuid-123', 'nonexistent-id'),
    ).rejects.toMatchObject({ statusCode: 404, code: 'PROFILE_NOT_FOUND' });
  });

  it('throws 404 when profile belongs to a different user (ownership check)', async () => {
    mockProfileRepo.findById.mockResolvedValue(mockProfile as never);

    // Different userId — should get 404 not 403
    await expect(
      profileService.getProfile('different-user-id', 'profile-uuid-xyz'),
    ).rejects.toMatchObject({ statusCode: 404, code: 'PROFILE_NOT_FOUND' });
  });
});

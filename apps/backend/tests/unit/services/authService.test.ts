// tests/unit/services/authService.test.ts
// Tests for authService business logic.
// Repositories and bcrypt are mocked so tests remain fast and DB-free.

import { authService } from '../../../src/services/authService';
import { userRepository } from '../../../src/repositories/userRepository';
import { AppError } from '../../../src/middleware/errorHandler';

// ─── Mocks ───────────────────────────────────────────────────────────────────

jest.mock('../../../src/repositories/userRepository');
jest.mock('../../../src/config/env', () => ({
  env: {
    jwtSecret: 'test-secret-key-that-is-long-enough',
    jwtExpiresIn: '7d',
    bcryptSaltRounds: 1, // use 1 round in tests — fast, still functional
  },
}));

const mockUserRepo = userRepository as jest.Mocked<typeof userRepository>;

// ─── Test Data ────────────────────────────────────────────────────────────────

const validRegisterInput = {
  email: 'alice@example.com',
  name: 'Alice Smith',
  password: 'SecurePass1',
};

const mockUser = {
  id: 'user-uuid-123',
  email: 'alice@example.com',
  name: 'Alice Smith',
  passwordHash: '$2b$01$somehashvalue',
  createdAt: new Date(),
  updatedAt: new Date(),
};

// ─── Register Tests ───────────────────────────────────────────────────────────

describe('authService.register', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('creates a user when input is valid and email is available', async () => {
    mockUserRepo.findByEmail.mockResolvedValue(null); // email not taken
    mockUserRepo.create.mockResolvedValue(mockUser);

    const result = await authService.register(validRegisterInput);

    expect(mockUserRepo.create).toHaveBeenCalledTimes(1);
    expect(result).toEqual({
      id: mockUser.id,
      email: mockUser.email,
      name: mockUser.name,
    });
  });

  it('normalises email to lowercase before saving', async () => {
    mockUserRepo.findByEmail.mockResolvedValue(null);
    mockUserRepo.create.mockResolvedValue({ ...mockUser, email: 'alice@example.com' });

    await authService.register({ ...validRegisterInput, email: 'ALICE@EXAMPLE.COM' });

    expect(mockUserRepo.findByEmail).toHaveBeenCalledWith('alice@example.com');
    expect(mockUserRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'alice@example.com' }),
    );
  });

  it('throws 409 when email is already taken', async () => {
    mockUserRepo.findByEmail.mockResolvedValue(mockUser);

    await expect(authService.register(validRegisterInput)).rejects.toMatchObject({
      statusCode: 409,
      code: 'EMAIL_TAKEN',
    });
    expect(mockUserRepo.create).not.toHaveBeenCalled();
  });

  it('throws 400 for invalid email format', async () => {
    await expect(
      authService.register({ ...validRegisterInput, email: 'not-an-email' }),
    ).rejects.toMatchObject({ statusCode: 400, code: 'VALIDATION_ERROR' });
  });

  it('throws 400 for a weak password', async () => {
    await expect(
      authService.register({ ...validRegisterInput, password: 'weak' }),
    ).rejects.toMatchObject({ statusCode: 400, code: 'VALIDATION_ERROR' });
  });

  it('does not store plaintext password', async () => {
    mockUserRepo.findByEmail.mockResolvedValue(null);
    mockUserRepo.create.mockResolvedValue(mockUser);

    await authService.register(validRegisterInput);

    const createCall = mockUserRepo.create.mock.calls[0]![0];
    expect(createCall.passwordHash).not.toBe(validRegisterInput.password);
    expect(createCall.passwordHash).toMatch(/^\$2b\$/); // bcrypt hash prefix
  });
});

// ─── Login Tests ──────────────────────────────────────────────────────────────

describe('authService.login', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns a token and user when credentials are correct', async () => {
    // Use a real bcrypt hash for the test password so comparison works
    const bcrypt = await import('bcrypt');
    const hash = await bcrypt.hash('SecurePass1', 1);
    mockUserRepo.findByEmail.mockResolvedValue({ ...mockUser, passwordHash: hash });

    const result = await authService.login({
      email: 'alice@example.com',
      password: 'SecurePass1',
    });

    expect(result).toHaveProperty('token');
    expect(result.user).toEqual({
      id: mockUser.id,
      email: mockUser.email,
      name: mockUser.name,
    });
  });

  it('throws 401 when user does not exist', async () => {
    mockUserRepo.findByEmail.mockResolvedValue(null);

    await expect(
      authService.login({ email: 'nobody@example.com', password: 'SecurePass1' }),
    ).rejects.toMatchObject({ statusCode: 401, code: 'INVALID_CREDENTIALS' });
  });

  it('throws 401 when password is incorrect', async () => {
    const bcrypt = await import('bcrypt');
    const hash = await bcrypt.hash('CorrectPass1', 1);
    mockUserRepo.findByEmail.mockResolvedValue({ ...mockUser, passwordHash: hash });

    await expect(
      authService.login({ email: 'alice@example.com', password: 'WrongPass1' }),
    ).rejects.toMatchObject({ statusCode: 401, code: 'INVALID_CREDENTIALS' });
  });

  it('returns the same error for wrong user vs wrong password (prevents enumeration)', async () => {
    // Both cases must throw AppError with the same code
    mockUserRepo.findByEmail.mockResolvedValue(null);
    const errorForMissingUser = await authService
      .login({ email: 'nobody@example.com', password: 'AnyPass1' })
      .catch((e: AppError) => e);

    const bcrypt = await import('bcrypt');
    const hash = await bcrypt.hash('CorrectPass1', 1);
    mockUserRepo.findByEmail.mockResolvedValue({ ...mockUser, passwordHash: hash });
    const errorForWrongPassword = await authService
      .login({ email: 'alice@example.com', password: 'WrongPass1' })
      .catch((e: AppError) => e);

    expect((errorForMissingUser as AppError).code).toBe('INVALID_CREDENTIALS');
    expect((errorForWrongPassword as AppError).code).toBe('INVALID_CREDENTIALS');
  });

  it('normalises email to lowercase before lookup', async () => {
    mockUserRepo.findByEmail.mockResolvedValue(null);

    await authService
      .login({ email: 'ALICE@EXAMPLE.COM', password: 'SecurePass1' })
      .catch(() => {}); // expected to fail — we only care about the call arg

    expect(mockUserRepo.findByEmail).toHaveBeenCalledWith('alice@example.com');
  });
});

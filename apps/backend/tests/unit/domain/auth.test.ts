// tests/unit/domain/auth.test.ts
// Tests for pure auth domain functions.
// No mocks needed — these are pure functions with no dependencies.

import { isValidEmail, isValidName, validatePassword } from '../../../src/domain/auth';

describe('validatePassword', () => {
  it('returns no errors for a valid password', () => {
    expect(validatePassword('SecurePass1!')).toEqual([]);
    expect(validatePassword('Abc@12345')).toEqual([]);
  });

  it('returns an error when password is too short', () => {
    const errors = validatePassword('Ab1');
    expect(errors).toContain('Password must be at least 8 characters long');
  });

  it('returns an error when password has no uppercase letter', () => {
    const errors = validatePassword('alllowercase1');
    expect(errors).toContain('Password must contain at least one uppercase letter');
  });

  it('returns an error when password has no number', () => {
    const errors = validatePassword('NoNumbersHere');
    expect(errors).toContain('Password must contain at least one number');
  });

  it('returns multiple errors for a completely invalid password', () => {
    const errors = validatePassword('bad');
    expect(errors.length).toBeGreaterThanOrEqual(2);
  });
});

describe('isValidEmail', () => {
  it('accepts valid email addresses', () => {
    expect(isValidEmail('user@example.com')).toBe(true);
    expect(isValidEmail('john.doe+tag@domain.co.uk')).toBe(true);
  });

  it('rejects invalid email addresses', () => {
    expect(isValidEmail('')).toBe(false);
    expect(isValidEmail('notanemail')).toBe(false);
    expect(isValidEmail('missing@domain')).toBe(false);
    expect(isValidEmail('@nodomain.com')).toBe(false);
  });
});

describe('isValidName', () => {
  it('accepts valid names', () => {
    expect(isValidName('Alice')).toBe(true);
    expect(isValidName('Jo')).toBe(true);
    expect(isValidName('A'.repeat(100))).toBe(true);
  });

  it('rejects names that are too short', () => {
    expect(isValidName('A')).toBe(false);
    expect(isValidName('')).toBe(false);
    expect(isValidName('  ')).toBe(false); // whitespace only
  });

  it('rejects names that are too long', () => {
    expect(isValidName('A'.repeat(101))).toBe(false);
  });
});

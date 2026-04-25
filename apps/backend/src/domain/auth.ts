// src/domain/auth.ts
// Pure functions for authentication-related business rules.
// NO database access. NO side effects. Fully deterministic and unit-testable.

/**
 * Password validation rules.
 * Returns a list of violation messages (empty array = valid).
 */
export function validatePassword(password: string): string[] {
  const errors: string[] = [];
  if (password.length < 8) errors.push('Password must be at least 8 characters long');
  if (!/[A-Z]/.test(password)) errors.push('Password must contain at least one uppercase letter');
  if (!/[0-9]/.test(password)) errors.push('Password must contain at least one number');
  return errors;
}

/**
 * Email validation.
 * Returns true if the email matches a basic RFC-5322-like pattern.
 */
export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/**
 * Name validation.
 */
export function isValidName(name: string): boolean {
  return name.trim().length >= 2 && name.trim().length <= 100;
}

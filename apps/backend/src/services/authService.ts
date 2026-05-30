// src/services/authService.ts
// All authentication business logic lives here.
// Controllers call this. This calls repositories and domain functions.
// NEVER access DB directly — always go through repositories.

import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { userRepository } from '../repositories/userRepository';
import { isValidEmail, isValidName, validatePassword } from '../domain/auth';
import { AppError } from '../middleware/errorHandler';
import { AuthResponse, LoginInput, RegisterInput } from '../types';

export const authService = {
  /**
   * Registers a new user.
   * Validates input, checks for duplicate emails, hashes password, persists user.
   */
  async register(input: RegisterInput): Promise<{ id: string; email: string; name: string }> {
    // 1. Validate input shape
    if (!isValidEmail(input.email)) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Invalid email address');
    }
    if (!isValidName(input.name)) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Name must be between 2 and 100 characters');
    }
    const passwordErrors = validatePassword(input.password);
    if (passwordErrors.length > 0) {
      throw new AppError(400, 'VALIDATION_ERROR', passwordErrors.join('. '));
    }

    // 2. Check for duplicate email
    const existing = await userRepository.findByEmail(input.email.toLowerCase());
    if (existing) {
      throw new AppError(409, 'EMAIL_TAKEN', 'An account with this email already exists');
    }

    // 3. Hash the password
    const passwordHash = await bcrypt.hash(input.password, env.bcryptSaltRounds);

    // 4. Persist user
    const user = await userRepository.create({
      email: input.email.toLowerCase(),
      name: input.name.trim(),
      passwordHash,
    });

    return { id: user.id, email: user.email, name: user.name };
  },

  /**
   * Logs in a user with email + password.
   * Returns a signed JWT on success.
   */
  async login(input: LoginInput): Promise<AuthResponse> {
    // 1. Find user by email
    const user = await userRepository.findByEmail(input.email.toLowerCase());

    // 2. Compare password — always compare even if user not found (prevents timing attacks)
    const dummyHash = '$2b$12$invalidhashthatisnevergoingtobevalid';
    const hashToCompare = user ? user.passwordHash : dummyHash;
    const passwordMatch = await bcrypt.compare(input.password, hashToCompare);

    if (!user || !passwordMatch) {
      // Same error for both "user not found" and "wrong password" — prevents user enumeration
      throw new AppError(401, 'INVALID_CREDENTIALS', 'Invalid email or password');
    }

    // 3. Issue JWT
    const payload = { userId: user.id, email: user.email };
    const token = jwt.sign(payload, env.jwtSecret, {
      expiresIn: env.jwtExpiresIn as jwt.SignOptions['expiresIn'],
    });

    return {
      token,
      user: { id: user.id, email: user.email, name: user.name },
    };
  },

  /**
   * Google login alternative.
   * Auto-creates account on backend if it doesn't exist.
   */
  async googleLogin(input: { email: string; name: string }): Promise<AuthResponse> {
    if (!isValidEmail(input.email)) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Invalid email address');
    }

    let user = await userRepository.findByEmail(input.email.toLowerCase());

    if (!user) {
      // Auto-create with secure random password hash
      const randomPassword = require('crypto').randomBytes(16).toString('hex') + 'A!1a';
      const passwordHash = await bcrypt.hash(randomPassword, env.bcryptSaltRounds);
      user = await userRepository.create({
        email: input.email.toLowerCase(),
        name: input.name.trim(),
        passwordHash,
      });
    }

    const payload = { userId: user.id, email: user.email };
    const token = jwt.sign(payload, env.jwtSecret, {
      expiresIn: env.jwtExpiresIn as jwt.SignOptions['expiresIn'],
    });

    return {
      token,
      user: { id: user.id, email: user.email, name: user.name },
    };
  },
};

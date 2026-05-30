// src/config/env.ts
// Loads and validates all environment variables at startup.
// The app will fail fast if required vars are missing.

import 'dotenv/config';

function requireEnv(key: string): string {
  const val = process.env[key];
  if (!val) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return val;
}

export const env = {
  port: parseInt(process.env['PORT'] ?? '3000', 10),
  nodeEnv: process.env['NODE_ENV'] ?? 'development',
  databaseUrl: process.env['DATABASE_URL'] ?? 'file:./dev.db',
  jwtSecret: process.env['JWT_SECRET'] ?? 'dev-secret-key',
  jwtExpiresIn: process.env['JWT_EXPIRES_IN'] ?? '7d',
  bcryptSaltRounds: parseInt(process.env['BCRYPT_SALT_ROUNDS'] ?? '12', 10),
};

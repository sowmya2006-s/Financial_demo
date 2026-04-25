// src/types/index.ts
// Shared TypeScript interfaces and DTOs used across layers.
// These are plain data shapes — no behaviour.

import { Difficulty, GameStatus } from './enums';

// ─── Auth ─────────────────────────────────────────────────────────────────────

export interface RegisterInput {
  email: string;
  name: string;
  password: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface AuthPayload {
  userId: string;
  email: string;
}

export interface AuthResponse {
  token: string;
  user: {
    id: string;
    email: string;
    name: string;
  };
}

// ─── Profile ──────────────────────────────────────────────────────────────────

export interface CreateProfileInput {
  name: string;
  difficulty: Difficulty;
}

export interface ProfileResponse {
  id: string;
  name: string;
  difficulty: Difficulty;
  cohortId: string;
  createdAt: Date;
}

// ─── Cohort ───────────────────────────────────────────────────────────────────

export interface CohortInfo {
  id: string;
  weekKey: string;
  startedAt: Date;
}

// ─── Game State ───────────────────────────────────────────────────────────────

export interface MetricsSnapshot {
  creditScore: number;
  socialScore: number;
  wellBeing: number;
  salary: number;
  currentWeek: number;
  status: GameStatus;
}

// ─── Express Request Extension ────────────────────────────────────────────────
// Augments Express's Request type so controllers can access req.user safely.

declare global {
  namespace Express {
    interface Request {
      user?: AuthPayload;
    }
  }
}

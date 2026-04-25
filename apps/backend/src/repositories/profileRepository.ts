// src/repositories/profileRepository.ts
// RULE: Only Prisma calls here. No business logic whatsoever.

import { Profile } from '@prisma/client';
import { Difficulty } from '../types/enums';
import prisma from '../config/prisma';

export const profileRepository = {
  async create(data: {
    userId: string;
    cohortId: string;
    name: string;
    difficulty: Difficulty;
  }): Promise<Profile> {
    return prisma.profile.create({ data });
  },

  async findById(id: string): Promise<Profile | null> {
    return prisma.profile.findUnique({
      where: { id },
      include: { gameState: true, cohort: true },
    });
  },

  async findByUserId(userId: string): Promise<Profile[]> {
    return prisma.profile.findMany({
      where: { userId },
      include: { cohort: true, gameState: true },
      orderBy: { createdAt: 'desc' },
    });
  },

  /**
   * Counts profiles for a user, optionally filtered by difficulty.
   * Used to enforce the max-profiles-per-difficulty rule.
   */
  async countByUserAndDifficulty(userId: string, difficulty: Difficulty): Promise<number> {
    return prisma.profile.count({ where: { userId, difficulty } });
  },

  async delete(id: string): Promise<void> {
    await prisma.profile.delete({ where: { id } });
  },
};

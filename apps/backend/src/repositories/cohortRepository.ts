// src/repositories/cohortRepository.ts
// RULE: Only Prisma calls here. No business logic whatsoever.

import { Cohort } from '@prisma/client';
import prisma from '../config/prisma';

export const cohortRepository = {
  async findByWeekKey(weekKey: string): Promise<Cohort | null> {
    return prisma.cohort.findUnique({ where: { weekKey } });
  },

  async findById(id: string): Promise<Cohort | null> {
    return prisma.cohort.findUnique({ where: { id } });
  },

  /**
   * Finds the cohort for the given weekKey, or creates it if it doesn't exist.
   * Uses upsert to handle concurrent registrations safely (idempotent).
   */
  async findOrCreate(weekKey: string): Promise<Cohort> {
    return prisma.cohort.upsert({
      where: { weekKey },
      update: {},
      create: { weekKey },
    });
  },

  async listAll(): Promise<Cohort[]> {
    return prisma.cohort.findMany({ orderBy: { startedAt: 'desc' } });
  },
};

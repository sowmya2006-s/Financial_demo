// src/repositories/userRepository.ts
// RULE: Only Prisma calls here. No business logic whatsoever.

import { User } from '@prisma/client';
import prisma from '../config/prisma';

export const userRepository = {
  async findByEmail(email: string): Promise<User | null> {
    return prisma.user.findUnique({ where: { email } });
  },

  async findById(id: string): Promise<User | null> {
    return prisma.user.findUnique({ where: { id } });
  },

  async create(data: { email: string; name: string; passwordHash: string }): Promise<User> {
    return prisma.user.create({ data });
  },
};

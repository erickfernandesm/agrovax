import { PrismaClient } from '@prisma/client';

/** Instancia unica do Prisma. O acesso ao banco acontece apenas nos services. */
export const prisma = new PrismaClient();

export type Db = PrismaClient;

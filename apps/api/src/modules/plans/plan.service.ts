import type { Plan, Prisma, PrismaClient } from '@prisma/client';
import { DEFAULT_PLANS } from './plan.defaults';

type Client = PrismaClient | Prisma.TransactionClient;

/** Garante que os planos padrao existem. Nao sobrescreve ajustes feitos no banco. */
export async function ensureDefaultPlans(db: Client): Promise<void> {
  for (const plan of DEFAULT_PLANS) {
    await db.plan.upsert({
      where: { code: plan.code },
      update: {},
      create: {
        code: plan.code,
        name: plan.name,
        limits: plan.limits as unknown as Prisma.InputJsonValue,
        features: plan.features,
        priceCents: plan.priceCents,
      },
    });
  }
}

export async function getFreePlan(db: Client): Promise<Plan> {
  const existing = await db.plan.findUnique({ where: { code: 'FREE' } });
  if (existing) return existing;
  await ensureDefaultPlans(db);
  return db.plan.findUniqueOrThrow({ where: { code: 'FREE' } });
}

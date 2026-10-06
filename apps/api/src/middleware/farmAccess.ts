import type { MemberRole } from '@agrovax/shared';
import type { PrismaClient } from '@prisma/client';
import type { Request, RequestHandler } from 'express';
import { z } from 'zod';
import { errors } from '../lib/errors';
import { currentUserId } from './authenticate';

export type FarmAccessFactory = (roles?: readonly MemberRole[]) => RequestHandler;

const uuid = z.uuid();

/**
 * Isolamento entre organizacoes: toda rota `/farms/:farmId/...` passa por
 * aqui. O usuario precisa ter vinculo (Membership) com a fazenda da URL.
 * Quem nao tem vinculo recebe 404, sem revelar que a fazenda existe.
 */
export function createFarmAccess(db: PrismaClient): FarmAccessFactory {
  return (roles) => async (req, _res, next) => {
    const userId = currentUserId(req);
    const farmId = uuid.safeParse(req.params.farmId);
    if (!farmId.success) throw errors.notFound('Fazenda não encontrada.');

    const membership = await db.membership.findUnique({
      where: { userId_farmId: { userId, farmId: farmId.data } },
      select: { role: true },
    });
    if (!membership) throw errors.notFound('Fazenda não encontrada.');
    if (roles && !roles.includes(membership.role)) throw errors.forbidden();

    req.farm = { id: farmId.data, role: membership.role };
    next();
  };
}

export function currentFarm(req: Request): { id: string; role: MemberRole } {
  if (!req.farm) throw errors.forbidden();
  return req.farm;
}

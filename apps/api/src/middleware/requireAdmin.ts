import type { PrismaClient } from '@prisma/client';
import type { RequestHandler } from 'express';
import { errors } from '../lib/errors';
import { currentUserId } from './authenticate';

/** Restringe a rota a administradores da plataforma (User.isPlatformAdmin). */
export function createRequireAdmin(db: PrismaClient): RequestHandler {
  return async (req, _res, next) => {
    const user = await db.user.findUnique({
      where: { id: currentUserId(req) },
      select: { isPlatformAdmin: true },
    });
    if (!user?.isPlatformAdmin) throw errors.forbidden();
    next();
  };
}

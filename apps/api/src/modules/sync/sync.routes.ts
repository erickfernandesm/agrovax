import { Router, type RequestHandler } from 'express';
import type { FarmAccessFactory } from '../../middleware/farmAccess';
import type { SyncController } from './sync.controller';

export function syncRoutes(
  controller: SyncController,
  authenticate: RequestHandler,
  farmAccess: FarmAccessFactory,
): Router {
  const router = Router();
  router.post('/farms/:farmId/sync/push', authenticate, farmAccess(), controller.push);
  router.get('/farms/:farmId/sync/pull', authenticate, farmAccess(), controller.pull);
  return router;
}

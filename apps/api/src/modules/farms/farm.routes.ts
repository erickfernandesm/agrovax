import { Router, type RequestHandler } from 'express';
import type { FarmAccessFactory } from '../../middleware/farmAccess';
import type { FarmController } from './farm.controller';

export function farmRoutes(
  controller: FarmController,
  authenticate: RequestHandler,
  farmAccess: FarmAccessFactory,
): Router {
  const router = Router();

  router.get('/farms', authenticate, controller.list);
  router.post('/farms', authenticate, controller.create);
  router.get('/farms/:farmId', authenticate, farmAccess(), controller.get);
  router.patch('/farms/:farmId', authenticate, farmAccess(['OWNER', 'MANAGER']), controller.update);

  return router;
}

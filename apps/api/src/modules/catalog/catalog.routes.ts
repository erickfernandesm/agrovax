import { Router, type Request, type RequestHandler, type Response } from 'express';
import type { CatalogService } from './catalog.service';

export class CatalogController {
  constructor(private readonly catalog: CatalogService) {}

  get = async (req: Request, res: Response): Promise<void> => {
    const version = typeof req.query.version === 'string' ? req.query.version : undefined;
    res.json(await this.catalog.get(version));
  };
}

export function catalogRoutes(controller: CatalogController, authenticate: RequestHandler): Router {
  const router = Router();
  router.get('/catalog', authenticate, controller.get);
  return router;
}

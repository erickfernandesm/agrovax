import { MAX_PULL_LIMIT, syncPushSchema } from '@agrovax/shared';
import type { Request, Response } from 'express';
import { z } from 'zod';
import { parse } from '../../lib/validate';
import { currentUserId } from '../../middleware/authenticate';
import { currentFarm } from '../../middleware/farmAccess';
import type { SyncService } from './sync.service';

const pullQuerySchema = z.object({
  cursor: z.coerce.number().int().min(0).default(0),
  limit: z.coerce.number().int().min(1).max(MAX_PULL_LIMIT).default(500),
});

export class SyncController {
  constructor(private readonly sync: SyncService) {}

  push = async (req: Request, res: Response): Promise<void> => {
    const input = parse(syncPushSchema, req.body);
    res.json(await this.sync.push(currentFarm(req).id, currentUserId(req), input));
  };

  pull = async (req: Request, res: Response): Promise<void> => {
    const { cursor, limit } = parse(pullQuerySchema, req.query);
    res.json(await this.sync.pull(currentFarm(req).id, cursor, limit));
  };
}

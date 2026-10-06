import { createFarmSchema, updateFarmSchema } from '@agrovax/shared';
import type { Request, Response } from 'express';
import { parse } from '../../lib/validate';
import { currentUserId } from '../../middleware/authenticate';
import { currentFarm } from '../../middleware/farmAccess';
import type { FarmService } from './farm.service';

export class FarmController {
  constructor(private readonly farms: FarmService) {}

  list = async (req: Request, res: Response): Promise<void> => {
    res.json({ farms: await this.farms.listForUser(currentUserId(req)) });
  };

  create = async (req: Request, res: Response): Promise<void> => {
    const farm = await this.farms.create(currentUserId(req), parse(createFarmSchema, req.body));
    res.status(201).json({ farm });
  };

  get = async (req: Request, res: Response): Promise<void> => {
    res.json({ farm: await this.farms.getForUser(currentUserId(req), currentFarm(req).id) });
  };

  update = async (req: Request, res: Response): Promise<void> => {
    const farm = await this.farms.update(
      currentUserId(req),
      currentFarm(req).id,
      parse(updateFarmSchema, req.body),
    );
    res.json({ farm });
  };
}

import {
  diseaseInputSchema,
  diseaseUpdateSchema,
  PLAN_CODES,
  planUpdateSchema,
  subscriptionUpdateSchema,
  surveillanceInputSchema,
  surveillanceUpdateSchema,
  symptomInputSchema,
  symptomUpdateSchema,
} from '@agrovax/shared';
import { Router, type Request, type RequestHandler, type Response } from 'express';
import { z } from 'zod';
import { errors } from '../../lib/errors';
import { parse } from '../../lib/validate';
import type { SurveillanceService } from '../surveillance/surveillance.service';
import type { AdminService } from './admin.service';

const idParam = (req: Request): string => {
  const id = z.uuid().safeParse(req.params.id);
  if (!id.success) throw errors.notFound();
  return id.data;
};

type Handler = (req: Request, res: Response) => Promise<void>;

/**
 * Rotas administrativas (somente API no MVP; ainda nao ha painel web).
 * Todas exigem usuario com `isPlatformAdmin`.
 */
export function adminRoutes(
  admin: AdminService,
  surveillance: SurveillanceService,
  authenticate: RequestHandler,
  requireAdmin: RequestHandler,
): Router {
  const router = Router();
  router.use('/admin', authenticate, requireAdmin);

  const get = (path: string, handler: Handler) => router.get(`/admin${path}`, handler);
  const post = (path: string, handler: Handler) => router.post(`/admin${path}`, handler);
  const patch = (path: string, handler: Handler) => router.patch(`/admin${path}`, handler);
  const del = (path: string, handler: Handler) => router.delete(`/admin${path}`, handler);

  get('/users', async (_req, res) => void res.json({ users: await admin.listUsers() }));
  get('/farms', async (_req, res) => void res.json({ farms: await admin.listFarms() }));

  get('/diseases', async (_req, res) => void res.json({ diseases: await admin.listDiseases() }));
  post('/diseases', async (req, res) => {
    res.status(201).json({ disease: await admin.createDisease(parse(diseaseInputSchema, req.body)) });
  });
  patch('/diseases/:id', async (req, res) => {
    res.json({ disease: await admin.updateDisease(idParam(req), parse(diseaseUpdateSchema, req.body)) });
  });
  del('/diseases/:id', async (req, res) => {
    await admin.deleteDisease(idParam(req));
    res.status(204).end();
  });

  get('/symptoms', async (_req, res) => void res.json({ symptoms: await admin.listSymptoms() }));
  post('/symptoms', async (req, res) => {
    res.status(201).json({ symptom: await admin.createSymptom(parse(symptomInputSchema, req.body)) });
  });
  patch('/symptoms/:id', async (req, res) => {
    res.json({ symptom: await admin.updateSymptom(idParam(req), parse(symptomUpdateSchema, req.body)) });
  });
  del('/symptoms/:id', async (req, res) => {
    await admin.deleteSymptom(idParam(req));
    res.status(204).end();
  });

  get('/surveillance', async (_req, res) => void res.json({ alerts: await admin.listSurveillance() }));
  post('/surveillance', async (req, res) => {
    const alert = await admin.createSurveillance(parse(surveillanceInputSchema, req.body));
    res.status(201).json({ alert });
  });
  post('/surveillance/import', async (_req, res) => {
    if (!surveillance.hasProviders) {
      throw errors.conflict('NO_PROVIDER', 'Nenhuma fonte externa de vigilância está configurada.');
    }
    res.json({ imports: await surveillance.importAll() });
  });
  patch('/surveillance/:id', async (req, res) => {
    const alert = await admin.updateSurveillance(idParam(req), parse(surveillanceUpdateSchema, req.body));
    res.json({ alert });
  });
  del('/surveillance/:id', async (req, res) => {
    await admin.deleteSurveillance(idParam(req));
    res.status(204).end();
  });

  get('/plans', async (_req, res) => void res.json({ plans: await admin.listPlans() }));
  patch('/plans/:code', async (req, res) => {
    const code = parse(z.enum(PLAN_CODES), String(req.params.code).toUpperCase());
    res.json({ plan: await admin.updatePlan(code, parse(planUpdateSchema, req.body)) });
  });
  patch('/farms/:id/subscription', async (req, res) => {
    const subscription = await admin.updateSubscription(
      idParam(req),
      parse(subscriptionUpdateSchema, req.body),
    );
    res.json({ subscription });
  });

  return router;
}

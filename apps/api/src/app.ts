import type { PrismaClient } from '@prisma/client';
import cors from 'cors';
import express, { type Express } from 'express';
import helmet from 'helmet';
import { pinoHttp } from 'pino-http';
import { env } from './config/env';
import { logger } from './lib/logger';
import { createAuthenticate } from './middleware/authenticate';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import { createFarmAccess } from './middleware/farmAccess';
import { createRateLimiters, DEFAULT_RATE_LIMIT, type RateLimitConfig } from './middleware/rateLimit';
import { AuthController } from './modules/auth/auth.controller';
import { authRoutes } from './modules/auth/auth.routes';
import { AuthService } from './modules/auth/auth.service';
import { TokenService } from './modules/auth/token.service';
import { FarmController } from './modules/farms/farm.controller';
import { farmRoutes } from './modules/farms/farm.routes';
import { FarmService } from './modules/farms/farm.service';
import { createRequireAdmin } from './middleware/requireAdmin';
import { adminRoutes } from './modules/admin/admin.routes';
import { AdminService } from './modules/admin/admin.service';
import { CatalogController, catalogRoutes } from './modules/catalog/catalog.routes';
import { CatalogService } from './modules/catalog/catalog.service';
import {
  configuredProviders,
  type SurveillanceProvider,
} from './modules/surveillance/surveillance.providers';
import { SurveillanceService } from './modules/surveillance/surveillance.service';
import { SyncController } from './modules/sync/sync.controller';
import { syncRoutes } from './modules/sync/sync.routes';
import { SyncService } from './modules/sync/sync.service';
import type { Mailer } from './services/mailer';

export interface AppDependencies {
  db: PrismaClient;
  mailer: Mailer;
  rateLimit?: RateLimitConfig;
  /** Fontes externas de vigilancia; por padrao, as configuradas no ambiente. */
  surveillanceProviders?: SurveillanceProvider[];
}

/**
 * Monta a aplicacao Express. As dependencias sao injetadas para que os
 * testes usem o mesmo codigo com banco e e-mail controlados.
 */
export function createApp({
  db,
  mailer,
  rateLimit = DEFAULT_RATE_LIMIT,
  surveillanceProviders,
}: AppDependencies): Express {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', env.TRUST_PROXY);

  const origins = env.CORS_ORIGINS.split(',').map((o) => o.trim()).filter(Boolean);
  const limiters = createRateLimiters(rateLimit);

  app.use(helmet());
  // O app mobile nao envia Origin; CORS so libera navegadores explicitamente listados.
  app.use(cors({ origin: origins.length > 0 ? origins : false }));
  app.use(express.json({ limit: '1mb' }));
  if (env.NODE_ENV !== 'test') {
    app.use(pinoHttp({ logger, autoLogging: { ignore: (req) => req.url === '/health' } }));
  }

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  const tokenService = new TokenService(db);
  const farmService = new FarmService(db);
  const authService = new AuthService(db, tokenService, farmService, mailer);

  const authenticate = createAuthenticate(tokenService);
  const farmAccess = createFarmAccess(db);

  const surveillanceService = new SurveillanceService(
    db,
    surveillanceProviders ?? configuredProviders(),
  );

  const v1 = express.Router();
  v1.use(limiters.global);
  v1.use(authRoutes(new AuthController(authService), authenticate, limiters.auth));
  v1.use(farmRoutes(new FarmController(farmService), authenticate, farmAccess));
  v1.use(syncRoutes(new SyncController(new SyncService(db)), authenticate, farmAccess));
  v1.use(catalogRoutes(new CatalogController(new CatalogService(db)), authenticate));
  v1.use(adminRoutes(new AdminService(db), surveillanceService, authenticate, createRequireAdmin(db)));
  app.use('/v1', v1);

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}

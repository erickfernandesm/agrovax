import type { RequestHandler } from 'express';
import rateLimit from 'express-rate-limit';
import { errors } from '../lib/errors';

export interface RateLimitConfig {
  windowMs: number;
  /** Requisicoes por IP na janela, para a API como um todo. */
  globalMax: number;
  /** Requisicoes por IP na janela, para login/cadastro/recuperacao de senha. */
  authMax: number;
}

export const DEFAULT_RATE_LIMIT: RateLimitConfig = {
  windowMs: 15 * 60 * 1000,
  globalMax: 600,
  authMax: 20,
};

function limiter(windowMs: number, limit: number): RequestHandler {
  return rateLimit({
    windowMs,
    limit,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    handler: (_req, _res, next) => next(errors.tooManyRequests()),
  });
}

export function createRateLimiters(config: RateLimitConfig): {
  global: RequestHandler;
  auth: RequestHandler;
} {
  return {
    global: limiter(config.windowMs, config.globalMax),
    auth: limiter(config.windowMs, config.authMax),
  };
}

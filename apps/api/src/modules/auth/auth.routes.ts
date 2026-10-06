import { Router, type RequestHandler } from 'express';
import type { AuthController } from './auth.controller';

export function authRoutes(
  controller: AuthController,
  authenticate: RequestHandler,
  authLimiter: RequestHandler,
): Router {
  const router = Router();

  router.post('/auth/register', authLimiter, controller.register);
  router.post('/auth/login', authLimiter, controller.login);
  router.post('/auth/forgot-password', authLimiter, controller.forgotPassword);
  router.post('/auth/reset-password', authLimiter, controller.resetPassword);
  router.post('/auth/refresh', controller.refresh);
  router.post('/auth/logout', controller.logout);
  router.get('/me', authenticate, controller.me);

  return router;
}

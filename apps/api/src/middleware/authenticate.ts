import type { Request, RequestHandler } from 'express';
import { errors } from '../lib/errors';
import type { TokenService } from '../modules/auth/token.service';

/** Exige um access token valido no cabecalho Authorization: Bearer <token>. */
export function createAuthenticate(tokens: TokenService): RequestHandler {
  return (req, _res, next) => {
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) throw errors.unauthorized();
    req.auth = { userId: tokens.verifyAccessToken(header.slice('Bearer '.length)) };
    next();
  };
}

export function currentUserId(req: Request): string {
  if (!req.auth) throw errors.unauthorized();
  return req.auth.userId;
}

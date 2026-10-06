import { randomUUID } from 'node:crypto';
import type { AuthTokens } from '@agrovax/shared';
import type { Prisma, PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';
import { env } from '../../config/env';
import { generateOpaqueToken, hashOpaqueToken } from '../../lib/crypto';
import { errors } from '../../lib/errors';

type Client = PrismaClient | Prisma.TransactionClient;

const ACCESS_TTL_SECONDS = env.ACCESS_TOKEN_TTL_MINUTES * 60;
const REFRESH_TTL_MS = env.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000;

/**
 * Janela em que um refresh token ja rotacionado ainda e aceito.
 * Com sinal fraco a resposta da renovacao pode se perder; sem essa tolerancia
 * o aparelho ficaria com um token invalido e o produtor seria deslogado.
 */
const ROTATION_GRACE_MS = 2 * 60 * 1000;

export class TokenService {
  constructor(private readonly db: PrismaClient) {}

  signAccessToken(userId: string): string {
    return jwt.sign({}, env.JWT_ACCESS_SECRET, {
      subject: userId,
      expiresIn: ACCESS_TTL_SECONDS,
      algorithm: 'HS256',
    });
  }

  /** Retorna o id do usuario ou lanca 401. */
  verifyAccessToken(token: string): string {
    try {
      const payload = jwt.verify(token, env.JWT_ACCESS_SECRET, { algorithms: ['HS256'] });
      if (typeof payload === 'string' || !payload.sub) throw new Error('payload invalido');
      return payload.sub;
    } catch {
      throw errors.unauthorized();
    }
  }

  /** Abre uma nova sessao (login/cadastro). */
  async issue(userId: string, db: Client = this.db): Promise<AuthTokens> {
    return this.createTokens(db, userId, randomUUID());
  }

  /** Troca um refresh token valido por um novo par de tokens (rotacao). */
  async rotate(refreshToken: string): Promise<{ userId: string; tokens: AuthTokens }> {
    const current = await this.db.refreshToken.findUnique({
      where: { tokenHash: hashOpaqueToken(refreshToken) },
    });
    if (!current || current.expiresAt.getTime() < Date.now()) throw errors.unauthorized();

    if (current.revokedAt) {
      const withinGrace =
        current.replacedById !== null &&
        Date.now() - current.revokedAt.getTime() <= ROTATION_GRACE_MS;
      if (!withinGrace) {
        // Reuso de token antigo: possivel roubo. Encerra todas as sessoes da familia.
        await this.revokeFamily(current.familyId);
        throw errors.unauthorized();
      }
      const tokens = await this.createTokens(this.db, current.userId, current.familyId);
      return { userId: current.userId, tokens };
    }

    const tokens = await this.db.$transaction(async (tx) => {
      const { tokens: created, id } = await this.createTokensWithId(tx, current.userId, current.familyId);
      await tx.refreshToken.update({
        where: { id: current.id },
        data: { revokedAt: new Date(), replacedById: id },
      });
      return created;
    });
    return { userId: current.userId, tokens };
  }

  /** Logout: encerra a sessao a que o refresh token pertence. */
  async revokeByToken(refreshToken: string): Promise<void> {
    const current = await this.db.refreshToken.findUnique({
      where: { tokenHash: hashOpaqueToken(refreshToken) },
    });
    if (current) await this.revokeFamily(current.familyId);
  }

  async revokeAllForUser(userId: string, db: Client = this.db): Promise<void> {
    await db.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  private async revokeFamily(familyId: string): Promise<void> {
    await this.db.refreshToken.updateMany({
      where: { familyId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  private async createTokens(db: Client, userId: string, familyId: string): Promise<AuthTokens> {
    return (await this.createTokensWithId(db, userId, familyId)).tokens;
  }

  private async createTokensWithId(
    db: Client,
    userId: string,
    familyId: string,
  ): Promise<{ id: string; tokens: AuthTokens }> {
    const refreshToken = generateOpaqueToken();
    const row = await db.refreshToken.create({
      data: {
        userId,
        familyId,
        tokenHash: hashOpaqueToken(refreshToken),
        expiresAt: new Date(Date.now() + REFRESH_TTL_MS),
      },
    });
    return {
      id: row.id,
      tokens: {
        accessToken: this.signAccessToken(userId),
        refreshToken,
        expiresIn: ACCESS_TTL_SECONDS,
      },
    };
  }
}

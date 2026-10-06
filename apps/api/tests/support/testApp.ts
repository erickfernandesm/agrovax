import { randomUUID } from 'node:crypto';
import type { AuthResponse } from '@agrovax/shared';
import type { Express } from 'express';
import request from 'supertest';
import { createApp } from '../../src/app';
import { prisma } from '../../src/lib/prisma';
import type { RateLimitConfig } from '../../src/middleware/rateLimit';
import type { MailMessage, Mailer } from '../../src/services/mailer';

/** Mailer de teste: guarda as mensagens em memoria. */
export class FakeMailer implements Mailer {
  readonly sent: MailMessage[] = [];

  async send(message: MailMessage): Promise<void> {
    this.sent.push(message);
  }

  /** Extrai o codigo de 6 digitos do ultimo e-mail enviado para o endereco. */
  lastCodeFor(email: string): string {
    const message = [...this.sent].reverse().find((m) => m.to === email);
    const code = message?.text.match(/\b(\d{6})\b/)?.[1];
    if (!code) throw new Error(`nenhum codigo enviado para ${email}`);
    return code;
  }
}

const NO_LIMIT: RateLimitConfig = { windowMs: 60_000, globalMax: 100_000, authMax: 100_000 };

export interface TestContext {
  app: Express;
  mailer: FakeMailer;
}

export function createTestApp(rateLimit: RateLimitConfig = NO_LIMIT): TestContext {
  const mailer = new FakeMailer();
  return { app: createApp({ db: prisma, mailer, rateLimit }), mailer };
}

export function uniqueEmail(prefix = 'produtor'): string {
  return `${prefix}-${randomUUID()}@teste.agrovax`;
}

export const DEFAULT_PASSWORD = 'senha-de-teste-123';

/** Cadastra um produtor com sua fazenda e devolve a resposta de autenticacao. */
export async function registerUser(
  app: Express,
  overrides: Partial<{ name: string; email: string; password: string; farmName: string }> = {},
): Promise<AuthResponse & { email: string; password: string }> {
  const email = overrides.email ?? uniqueEmail();
  const password = overrides.password ?? DEFAULT_PASSWORD;
  const response = await request(app)
    .post('/v1/auth/register')
    .send({
      name: overrides.name ?? 'Produtor Teste',
      email,
      password,
      farmName: overrides.farmName ?? 'Fazenda Teste',
    })
    .expect(201);
  return { ...(response.body as AuthResponse), email, password };
}

export function bearer(token: string): { Authorization: string } {
  return { Authorization: `Bearer ${token}` };
}

export { prisma };

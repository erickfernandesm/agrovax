import type { AuthResponse, AuthTokens } from '@agrovax/shared';
import request from 'supertest';
import { afterAll, describe, expect, it } from 'vitest';
import {
  bearer,
  createTestApp,
  DEFAULT_PASSWORD,
  prisma,
  registerUser,
  uniqueEmail,
} from './support/testApp';

const { app, mailer } = createTestApp();

afterAll(async () => {
  await prisma.$disconnect();
});

describe('cadastro', () => {
  it('cria usuario, fazenda, vinculo de dono e assinatura gratuita', async () => {
    const auth = await registerUser(app, { farmName: 'Fazenda Boa Vista' });

    expect(auth.accessToken).toEqual(expect.any(String));
    expect(auth.refreshToken).toEqual(expect.any(String));
    expect(auth.user.email).toBe(auth.email);
    expect(auth.farms).toHaveLength(1);
    expect(auth.farms[0]).toMatchObject({
      name: 'Fazenda Boa Vista',
      role: 'OWNER',
      subscription: { plan: 'FREE', status: 'ACTIVE' },
    });
  });

  it('nunca devolve nem guarda a senha em texto puro', async () => {
    const auth = await registerUser(app);
    expect(JSON.stringify(auth.user)).not.toContain('password');

    const stored = await prisma.user.findUniqueOrThrow({ where: { email: auth.email } });
    expect(stored.passwordHash).not.toContain(DEFAULT_PASSWORD);
    expect(stored.passwordHash.startsWith('$2')).toBe(true);
  });

  it('recusa e-mail ja cadastrado, ignorando maiusculas', async () => {
    const auth = await registerUser(app);
    const response = await request(app)
      .post('/v1/auth/register')
      .send({
        name: 'Outro',
        email: auth.email.toUpperCase(),
        password: DEFAULT_PASSWORD,
        farmName: 'Outra Fazenda',
      })
      .expect(409);
    expect(response.body.error.code).toBe('EMAIL_IN_USE');
  });

  it('valida os campos e informa o erro por campo', async () => {
    const response = await request(app)
      .post('/v1/auth/register')
      .send({ name: 'A', email: 'invalido', password: '123', farmName: '' })
      .expect(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
    expect(Object.keys(response.body.error.fields)).toEqual(
      expect.arrayContaining(['name', 'email', 'password', 'farmName']),
    );
  });

  it('nao deixa fazenda orfa quando o cadastro falha', async () => {
    const auth = await registerUser(app);
    const farmsBefore = await prisma.farm.count();
    await request(app)
      .post('/v1/auth/register')
      .send({ name: 'Outro', email: auth.email, password: DEFAULT_PASSWORD, farmName: 'Orfa' })
      .expect(409);
    expect(await prisma.farm.count()).toBe(farmsBefore);
  });
});

describe('login', () => {
  it('autentica com credenciais corretas', async () => {
    const auth = await registerUser(app);
    const response = await request(app)
      .post('/v1/auth/login')
      .send({ email: auth.email, password: auth.password })
      .expect(200);
    const body = response.body as AuthResponse;
    expect(body.user.id).toBe(auth.user.id);
    expect(body.farms).toHaveLength(1);
  });

  it('responde igual para senha errada e para e-mail inexistente', async () => {
    const auth = await registerUser(app);
    const wrongPassword = await request(app)
      .post('/v1/auth/login')
      .send({ email: auth.email, password: 'senha-errada-000' })
      .expect(401);
    const unknownEmail = await request(app)
      .post('/v1/auth/login')
      .send({ email: uniqueEmail('ninguem'), password: 'senha-errada-000' })
      .expect(401);
    expect(wrongPassword.body).toEqual(unknownEmail.body);
    expect(wrongPassword.body.error.code).toBe('INVALID_CREDENTIALS');
  });
});

describe('protecao de rotas', () => {
  it('GET /me exige token', async () => {
    await request(app).get('/v1/me').expect(401);
    await request(app).get('/v1/me').set(bearer('token-invalido')).expect(401);
  });

  it('GET /me devolve usuario e fazendas com token valido', async () => {
    const auth = await registerUser(app);
    const response = await request(app).get('/v1/me').set(bearer(auth.accessToken)).expect(200);
    expect(response.body.user.id).toBe(auth.user.id);
    expect(response.body.farms[0].id).toBe(auth.farms[0]?.id);
  });

  it('recusa token assinado com outro segredo', async () => {
    const jwt = await import('jsonwebtoken');
    const forged = jwt.default.sign({}, 'outro-segredo-qualquer-com-tamanho-suficiente', {
      subject: '00000000-0000-4000-8000-000000000000',
    });
    await request(app).get('/v1/me').set(bearer(forged)).expect(401);
  });
});

describe('sessao persistente (refresh token)', () => {
  it('renova a sessao e rotaciona o refresh token', async () => {
    const auth = await registerUser(app);
    const response = await request(app)
      .post('/v1/auth/refresh')
      .send({ refreshToken: auth.refreshToken })
      .expect(200);
    const tokens = response.body as AuthTokens;
    expect(tokens.refreshToken).not.toBe(auth.refreshToken);
    await request(app).get('/v1/me').set(bearer(tokens.accessToken)).expect(200);
  });

  it('tolera o reenvio do token anterior logo apos a rotacao (resposta perdida)', async () => {
    const auth = await registerUser(app);
    await request(app).post('/v1/auth/refresh').send({ refreshToken: auth.refreshToken }).expect(200);
    await request(app).post('/v1/auth/refresh').send({ refreshToken: auth.refreshToken }).expect(200);
  });

  it('trata reuso tardio de token antigo como roubo e encerra a sessao inteira', async () => {
    const auth = await registerUser(app);
    const rotated = await request(app)
      .post('/v1/auth/refresh')
      .send({ refreshToken: auth.refreshToken })
      .expect(200);

    // Simula o fim da janela de tolerancia.
    await prisma.refreshToken.updateMany({
      where: { userId: auth.user.id, revokedAt: { not: null } },
      data: { revokedAt: new Date(Date.now() - 10 * 60 * 1000) },
    });

    await request(app).post('/v1/auth/refresh').send({ refreshToken: auth.refreshToken }).expect(401);
    await request(app)
      .post('/v1/auth/refresh')
      .send({ refreshToken: (rotated.body as AuthTokens).refreshToken })
      .expect(401);
  });

  it('recusa refresh token desconhecido', async () => {
    await request(app)
      .post('/v1/auth/refresh')
      .send({ refreshToken: 'x'.repeat(64) })
      .expect(401);
  });

  it('logout invalida o refresh token', async () => {
    const auth = await registerUser(app);
    await request(app).post('/v1/auth/logout').send({ refreshToken: auth.refreshToken }).expect(204);
    await request(app).post('/v1/auth/refresh').send({ refreshToken: auth.refreshToken }).expect(401);
  });
});

describe('recuperacao de senha', () => {
  it('redefine a senha com o codigo enviado por e-mail e encerra as sessoes antigas', async () => {
    const auth = await registerUser(app);
    await request(app).post('/v1/auth/forgot-password').send({ email: auth.email }).expect(202);
    const code = mailer.lastCodeFor(auth.email);

    await request(app)
      .post('/v1/auth/reset-password')
      .send({ email: auth.email, code, password: 'nova-senha-456' })
      .expect(204);

    await request(app)
      .post('/v1/auth/login')
      .send({ email: auth.email, password: auth.password })
      .expect(401);
    await request(app)
      .post('/v1/auth/login')
      .send({ email: auth.email, password: 'nova-senha-456' })
      .expect(200);
    await request(app).post('/v1/auth/refresh').send({ refreshToken: auth.refreshToken }).expect(401);
  });

  it('nao revela se o e-mail existe e nao envia nada para e-mail desconhecido', async () => {
    const email = uniqueEmail('desconhecido');
    const response = await request(app).post('/v1/auth/forgot-password').send({ email }).expect(202);
    expect(response.body.message).toEqual(expect.any(String));
    expect(mailer.sent.some((m) => m.to === email)).toBe(false);
  });

  it('o codigo so pode ser usado uma vez', async () => {
    const auth = await registerUser(app);
    await request(app).post('/v1/auth/forgot-password').send({ email: auth.email }).expect(202);
    const code = mailer.lastCodeFor(auth.email);
    const payload = { email: auth.email, code, password: 'nova-senha-456' };
    await request(app).post('/v1/auth/reset-password').send(payload).expect(204);
    await request(app).post('/v1/auth/reset-password').send(payload).expect(400);
  });

  it('bloqueia o codigo apos 5 tentativas erradas', async () => {
    const auth = await registerUser(app);
    await request(app).post('/v1/auth/forgot-password').send({ email: auth.email }).expect(202);
    const code = mailer.lastCodeFor(auth.email);
    const wrong = code === '000000' ? '111111' : '000000';

    for (let attempt = 0; attempt < 5; attempt += 1) {
      await request(app)
        .post('/v1/auth/reset-password')
        .send({ email: auth.email, code: wrong, password: 'nova-senha-456' })
        .expect(400);
    }
    // Mesmo o codigo correto deixa de valer.
    await request(app)
      .post('/v1/auth/reset-password')
      .send({ email: auth.email, code, password: 'nova-senha-456' })
      .expect(400);
  });

  it('recusa codigo expirado', async () => {
    const auth = await registerUser(app);
    await request(app).post('/v1/auth/forgot-password').send({ email: auth.email }).expect(202);
    const code = mailer.lastCodeFor(auth.email);
    await prisma.passwordResetToken.updateMany({
      where: { userId: auth.user.id },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });
    await request(app)
      .post('/v1/auth/reset-password')
      .send({ email: auth.email, code, password: 'nova-senha-456' })
      .expect(400);
  });
});

describe('rate limiting', () => {
  it('limita tentativas nas rotas de autenticacao', async () => {
    const limited = createTestApp({ windowMs: 60_000, globalMax: 1000, authMax: 3 });
    const attempt = () =>
      request(limited.app)
        .post('/v1/auth/login')
        .send({ email: uniqueEmail(), password: 'senha-errada-000' });

    for (let i = 0; i < 3; i += 1) expect((await attempt()).status).toBe(401);
    const blocked = await attempt();
    expect(blocked.status).toBe(429);
    expect(blocked.body.error.code).toBe('TOO_MANY_REQUESTS');
  });
});

import type { CatalogDto } from '@agrovax/shared';
import request from 'supertest';
import { afterAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app';
import type { ExternalAlert, SurveillanceProvider } from '../src/modules/surveillance/surveillance.providers';
import { bearer, createTestApp, FakeMailer, prisma, registerUser } from './support/testApp';

const { app } = createTestApp();

afterAll(async () => {
  await prisma.$disconnect();
});

async function registerAdmin(target = app) {
  const auth = await registerUser(target);
  await prisma.user.update({ where: { id: auth.user.id }, data: { isPlatformAdmin: true } });
  return auth;
}

const unique = (prefix: string) => `${prefix}-${Math.random().toString(36).slice(2, 10)}`;

async function catalog(token: string, version?: string) {
  const response = await request(app)
    .get(`/v1/catalog${version ? `?version=${version}` : ''}`)
    .set(bearer(token))
    .expect(200);
  return response.body as CatalogDto & { unchanged?: boolean };
}

describe('acesso administrativo', () => {
  it('usuario comum nao acessa rotas de administracao', async () => {
    const user = await registerUser(app);
    await request(app).get('/v1/admin/users').set(bearer(user.accessToken)).expect(403);
    await request(app)
      .post('/v1/admin/diseases')
      .set(bearer(user.accessToken))
      .send({ slug: 'x', name: 'X', species: ['BOVINE'] })
      .expect(403);
    await request(app).get('/v1/admin/users').expect(401);
  });

  it('administrador lista usuarios e fazendas', async () => {
    const admin = await registerAdmin();
    const users = await request(app).get('/v1/admin/users').set(bearer(admin.accessToken)).expect(200);
    expect(users.body.users.some((u: { id: string }) => u.id === admin.user.id)).toBe(true);
    expect(JSON.stringify(users.body)).not.toContain('passwordHash');

    const farms = await request(app).get('/v1/admin/farms').set(bearer(admin.accessToken)).expect(200);
    expect(farms.body.farms.length).toBeGreaterThan(0);
  });
});

describe('biblioteca de doencas e sintomas', () => {
  it('o conteudo cadastrado pelo administrador chega ao app, com o selo DEMO', async () => {
    const admin = await registerAdmin();
    const user = await registerUser(app);

    const symptom = await request(app)
      .post('/v1/admin/symptoms')
      .set(bearer(admin.accessToken))
      .send({ slug: unique('sintoma'), name: 'Sintoma DEMO', isDemo: true })
      .expect(201);
    const symptomId = symptom.body.symptom.id as string;

    const slug = unique('doenca');
    await request(app)
      .post('/v1/admin/diseases')
      .set(bearer(admin.accessToken))
      .send({
        slug,
        name: 'Doença DEMO',
        species: ['BOVINE', 'EQUINE'],
        prevention: 'Texto ilustrativo DEMO.',
        riskLevel: 'MEDIUM',
        isDemo: true,
        symptomIds: [symptomId],
      })
      .expect(201);

    const data = await catalog(user.accessToken);
    const disease = data.diseases.find((d) => d.slug === slug);
    expect(disease).toMatchObject({ name: 'Doença DEMO', isDemo: true, symptomIds: [symptomId] });
    expect(data.symptoms.some((s) => s.id === symptomId && s.isDemo)).toBe(true);
  });

  it('doenca nao publicada nao aparece no app', async () => {
    const admin = await registerAdmin();
    const slug = unique('rascunho');
    await request(app)
      .post('/v1/admin/diseases')
      .set(bearer(admin.accessToken))
      .send({ slug, name: 'Rascunho', species: ['BOVINE'], published: false })
      .expect(201);
    expect((await catalog(admin.accessToken)).diseases.some((d) => d.slug === slug)).toBe(false);
  });

  it('recusa slug duplicado e edita/exclui doenca', async () => {
    const admin = await registerAdmin();
    const slug = unique('dup');
    const body = { slug, name: 'Original', species: ['EQUINE'] };
    const created = await request(app).post('/v1/admin/diseases').set(bearer(admin.accessToken)).send(body).expect(201);
    await request(app).post('/v1/admin/diseases').set(bearer(admin.accessToken)).send(body).expect(409);

    const id = created.body.disease.id as string;
    const updated = await request(app)
      .patch(`/v1/admin/diseases/${id}`)
      .set(bearer(admin.accessToken))
      .send({ name: 'Editada' })
      .expect(200);
    expect(updated.body.disease.name).toBe('Editada');

    await request(app).delete(`/v1/admin/diseases/${id}`).set(bearer(admin.accessToken)).expect(204);
    await request(app).delete(`/v1/admin/diseases/${id}`).set(bearer(admin.accessToken)).expect(404);
  });

  it('o catalogo informa quando nada mudou', async () => {
    const user = await registerUser(app);
    const first = await catalog(user.accessToken);
    const again = await catalog(user.accessToken, first.version);
    expect(again).toEqual({ version: first.version, unchanged: true });
  });

  it('o catalogo exige autenticacao', async () => {
    await request(app).get('/v1/catalog').expect(401);
  });
});

describe('vigilancia sanitaria', () => {
  const alert = {
    diseaseName: 'Doença DEMO',
    state: 'MG',
    region: 'Região DEMO',
    reportedAt: '2026-06-01',
    riskLevel: 'HIGH',
    description: 'Alerta fictício para demonstração.',
    guidance: 'Orientação fictícia para demonstração.',
    sourceName: 'DEMO AgroVax',
    isDemo: true,
  };

  it('todo alerta precisa de fonte', async () => {
    const admin = await registerAdmin();
    const { sourceName: _omit, ...withoutSource } = alert;
    await request(app)
      .post('/v1/admin/surveillance')
      .set(bearer(admin.accessToken))
      .send(withoutSource)
      .expect(400);
  });

  it('alerta cadastrado aparece no app com fonte e marcacao DEMO; inativo some', async () => {
    const admin = await registerAdmin();
    const created = await request(app)
      .post('/v1/admin/surveillance')
      .set(bearer(admin.accessToken))
      .send(alert)
      .expect(201);
    const id = created.body.alert.id as string;

    const visible = (await catalog(admin.accessToken)).surveillanceAlerts.find((a) => a.id === id);
    expect(visible).toMatchObject({ sourceName: 'DEMO AgroVax', isDemo: true, reportedAt: '2026-06-01' });

    await request(app)
      .patch(`/v1/admin/surveillance/${id}`)
      .set(bearer(admin.accessToken))
      .send({ active: false })
      .expect(200);
    expect((await catalog(admin.accessToken)).surveillanceAlerts.some((a) => a.id === id)).toBe(false);
  });

  it('sem fonte externa configurada, a importacao informa isso e nao cria dados', async () => {
    const admin = await registerAdmin();
    const before = await prisma.surveillanceAlert.count();
    const response = await request(app)
      .post('/v1/admin/surveillance/import')
      .set(bearer(admin.accessToken))
      .expect(409);
    expect(response.body.error.code).toBe('NO_PROVIDER');
    expect(await prisma.surveillanceAlert.count()).toBe(before);
  });

  it('importa de uma fonte externa sem duplicar ao reimportar e nunca como DEMO', async () => {
    const externalId = unique('ext');
    const item: ExternalAlert = {
      ...alert,
      riskLevel: 'HIGH',
      state: 'MG',
      sourceName: 'Fonte de teste',
      isDemo: true,
      active: true,
      externalId,
    };
    const provider: SurveillanceProvider = { key: 'teste', fetchAlerts: async () => [item] };
    const withProvider = createApp({
      db: prisma,
      mailer: new FakeMailer(),
      rateLimit: { windowMs: 60_000, globalMax: 100_000, authMax: 100_000 },
      surveillanceProviders: [provider],
    });
    const admin = await registerAdmin(withProvider);

    for (let i = 0; i < 2; i += 1) {
      const response = await request(withProvider)
        .post('/v1/admin/surveillance/import')
        .set(bearer(admin.accessToken))
        .expect(200);
      expect(response.body.imports).toEqual([{ provider: 'teste', imported: 1 }]);
    }
    const stored = await prisma.surveillanceAlert.findMany({ where: { providerKey: 'teste', externalId } });
    expect(stored).toHaveLength(1);
    expect(stored[0]?.isDemo).toBe(false);
  });
});

describe('planos e assinaturas', () => {
  it('administrador troca o plano de uma fazenda e os novos limites passam a valer', async () => {
    const admin = await registerAdmin();
    const user = await registerUser(app);
    const farmId = user.farms[0]?.id as string;

    const response = await request(app)
      .patch(`/v1/admin/farms/${farmId}/subscription`)
      .set(bearer(admin.accessToken))
      .send({ plan: 'PRO', status: 'ACTIVE', expiresAt: '2027-01-01T00:00:00.000Z' })
      .expect(200);
    expect(response.body.subscription).toMatchObject({ plan: 'PRO', status: 'ACTIVE' });

    const me = await request(app).get('/v1/me').set(bearer(user.accessToken)).expect(200);
    expect(me.body.farms[0].subscription).toMatchObject({ plan: 'PRO', limits: { maxAnimals: null } });
  });

  it('assinatura vencida aparece como EXPIRED', async () => {
    const admin = await registerAdmin();
    const user = await registerUser(app);
    await request(app)
      .patch(`/v1/admin/farms/${user.farms[0]?.id}/subscription`)
      .set(bearer(admin.accessToken))
      .send({ plan: 'PRO', expiresAt: '2020-01-01T00:00:00.000Z' })
      .expect(200);
    const me = await request(app).get('/v1/me').set(bearer(user.accessToken)).expect(200);
    expect(me.body.farms[0].subscription.status).toBe('EXPIRED');
  });

  it('lista os tres planos', async () => {
    const admin = await registerAdmin();
    const response = await request(app).get('/v1/admin/plans').set(bearer(admin.accessToken)).expect(200);
    expect(response.body.plans.map((p: { code: string }) => p.code).sort()).toEqual(['ENTERPRISE', 'FREE', 'PRO']);
  });
});

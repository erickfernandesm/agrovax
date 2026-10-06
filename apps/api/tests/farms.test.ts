import request from 'supertest';
import { afterAll, describe, expect, it } from 'vitest';
import { bearer, createTestApp, prisma, registerUser } from './support/testApp';

const { app } = createTestApp();

afterAll(async () => {
  await prisma.$disconnect();
});

describe('fazendas', () => {
  it('lista apenas as fazendas do proprio usuario', async () => {
    const ana = await registerUser(app, { farmName: 'Fazenda da Ana' });
    const bruno = await registerUser(app, { farmName: 'Fazenda do Bruno' });

    const response = await request(app).get('/v1/farms').set(bearer(ana.accessToken)).expect(200);
    const ids = (response.body.farms as { id: string }[]).map((f) => f.id);
    expect(ids).toEqual([ana.farms[0]?.id]);
    expect(ids).not.toContain(bruno.farms[0]?.id);
  });

  it('permite criar uma segunda fazenda na mesma conta', async () => {
    const ana = await registerUser(app);
    const created = await request(app)
      .post('/v1/farms')
      .set(bearer(ana.accessToken))
      .send({ name: 'Sítio Novo', city: 'Uberaba', state: 'MG' })
      .expect(201);
    expect(created.body.farm).toMatchObject({
      name: 'Sítio Novo',
      city: 'Uberaba',
      state: 'MG',
      role: 'OWNER',
      subscription: { plan: 'FREE' },
    });

    const list = await request(app).get('/v1/farms').set(bearer(ana.accessToken)).expect(200);
    expect(list.body.farms).toHaveLength(2);
  });

  it('atualiza os dados da fazenda', async () => {
    const ana = await registerUser(app);
    const farmId = ana.farms[0]?.id;
    const response = await request(app)
      .patch(`/v1/farms/${farmId}`)
      .set(bearer(ana.accessToken))
      .send({ name: 'Fazenda Renomeada', state: 'GO' })
      .expect(200);
    expect(response.body.farm).toMatchObject({ name: 'Fazenda Renomeada', state: 'GO' });
  });

  it('valida a UF', async () => {
    const ana = await registerUser(app);
    await request(app)
      .patch(`/v1/farms/${ana.farms[0]?.id}`)
      .set(bearer(ana.accessToken))
      .send({ state: 'XX' })
      .expect(400);
  });
});

describe('isolamento entre organizacoes', () => {
  it('um usuario nao le a fazenda de outro (404, sem revelar que existe)', async () => {
    const ana = await registerUser(app);
    const bruno = await registerUser(app);
    const response = await request(app)
      .get(`/v1/farms/${bruno.farms[0]?.id}`)
      .set(bearer(ana.accessToken))
      .expect(404);
    expect(response.body.error.code).toBe('NOT_FOUND');
  });

  it('um usuario nao altera a fazenda de outro', async () => {
    const ana = await registerUser(app);
    const bruno = await registerUser(app, { farmName: 'Fazenda do Bruno' });
    const brunoFarmId = bruno.farms[0]?.id;

    await request(app)
      .patch(`/v1/farms/${brunoFarmId}`)
      .set(bearer(ana.accessToken))
      .send({ name: 'Invadida' })
      .expect(404);

    const farm = await prisma.farm.findUniqueOrThrow({ where: { id: brunoFarmId } });
    expect(farm.name).toBe('Fazenda do Bruno');
  });

  it('colaborador (WORKER) le mas nao altera a fazenda', async () => {
    const owner = await registerUser(app);
    const worker = await registerUser(app);
    const farmId = owner.farms[0]?.id as string;
    await prisma.membership.create({ data: { userId: worker.user.id, farmId, role: 'WORKER' } });

    await request(app).get(`/v1/farms/${farmId}`).set(bearer(worker.accessToken)).expect(200);
    const response = await request(app)
      .patch(`/v1/farms/${farmId}`)
      .set(bearer(worker.accessToken))
      .send({ name: 'Sem permissao' })
      .expect(403);
    expect(response.body.error.code).toBe('FORBIDDEN');
  });

  it('id de fazenda malformado nao causa erro interno', async () => {
    const ana = await registerUser(app);
    await request(app).get('/v1/farms/nao-e-uuid').set(bearer(ana.accessToken)).expect(404);
  });

  it('rotas de fazenda exigem autenticacao', async () => {
    await request(app).get('/v1/farms').expect(401);
  });
});

describe('restricoes do banco', () => {
  it('registro sanitario precisa de animal OU lote, nunca ambos nem nenhum', async () => {
    const ana = await registerUser(app);
    const farmId = ana.farms[0]?.id as string;
    const lot = await prisma.lot.create({
      data: {
        id: crypto.randomUUID(),
        farmId,
        name: 'Lote Teste',
        declaredQuantity: 10,
        species: 'BOVINE',
      },
    });
    const animal = await prisma.animal.create({
      data: { id: crypto.randomUUID(), farmId, tag: 'T-001', species: 'BOVINE', sex: 'FEMALE' },
    });
    const base = { farmId, vaccineName: 'Vacina de teste', appliedAt: new Date('2026-06-21') };

    await expect(
      prisma.vaccination.create({ data: { ...base, id: crypto.randomUUID() } }),
    ).rejects.toThrow();
    await expect(
      prisma.vaccination.create({
        data: { ...base, id: crypto.randomUUID(), animalId: animal.id, lotId: lot.id },
      }),
    ).rejects.toThrow();
    await expect(
      prisma.vaccination.create({ data: { ...base, id: crypto.randomUUID(), lotId: lot.id } }),
    ).resolves.toMatchObject({ lotId: lot.id });
  });

  it('um lote pode existir sem animais individuais vinculados', async () => {
    const ana = await registerUser(app);
    const lot = await prisma.lot.create({
      data: {
        id: crypto.randomUUID(),
        farmId: ana.farms[0]?.id as string,
        name: 'Bezerros 2026',
        declaredQuantity: 2000,
        species: 'BOVINE',
        category: 'CALF',
      },
      include: { animals: true },
    });
    expect(lot.declaredQuantity).toBe(2000);
    expect(lot.animals).toHaveLength(0);
  });
});

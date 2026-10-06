import { randomUUID } from 'node:crypto';
import type { SyncOperationInput, SyncPullResponse, SyncPushResponse } from '@agrovax/shared';
import type { Express } from 'express';
import request from 'supertest';
import { afterAll, describe, expect, it } from 'vitest';
import { bearer, createTestApp, prisma, registerUser } from './support/testApp';

const { app } = createTestApp();

afterAll(async () => {
  await prisma.$disconnect();
});

type Auth = Awaited<ReturnType<typeof registerUser>>;

const farmOf = (auth: Auth) => auth.farms[0]?.id as string;

async function push(
  target: Express,
  auth: Auth,
  operations: SyncOperationInput[],
  deviceId = 'aparelho-1',
  farmId = farmOf(auth),
) {
  return request(target)
    .post(`/v1/farms/${farmId}/sync/push`)
    .set(bearer(auth.accessToken))
    .send({ deviceId, operations });
}

async function pushOk(auth: Auth, operations: SyncOperationInput[], deviceId?: string) {
  const response = await push(app, auth, operations, deviceId).then((r) => {
    expect(r.status).toBe(200);
    return r;
  });
  return (response.body as SyncPushResponse).results;
}

async function pull(auth: Auth, cursor = 0, limit = 500) {
  const response = await request(app)
    .get(`/v1/farms/${farmOf(auth)}/sync/pull?cursor=${cursor}&limit=${limit}`)
    .set(bearer(auth.accessToken))
    .expect(200);
  return response.body as SyncPullResponse;
}

const op = (
  entity: SyncOperationInput['entity'],
  recordId: string,
  changes: Record<string, unknown>,
  extra: Partial<SyncOperationInput> = {},
): SyncOperationInput => ({
  opId: randomUUID(),
  entity,
  recordId,
  action: 'UPSERT',
  baseVersion: 0,
  changes,
  ...extra,
});

const animalData = (over: Record<string, unknown> = {}) => ({
  lotId: null,
  tag: 'BR-001',
  name: 'Estrela',
  species: 'BOVINE',
  sex: 'FEMALE',
  birthDate: '2023-04-10',
  breed: 'Nelore',
  category: 'COW',
  purpose: 'BEEF',
  ownerName: null,
  status: 'ACTIVE',
  notes: null,
  ...over,
});

const lotData = (over: Record<string, unknown> = {}) => ({
  name: 'Bezerros 2026',
  declaredQuantity: 2000,
  species: 'BOVINE',
  category: 'CALF',
  purpose: 'BEEF',
  ageRange: '0 a 8 meses',
  location: 'Pasto 3',
  notes: null,
  ...over,
});

const vaccinationData = (over: Record<string, unknown> = {}) => ({
  animalId: null,
  lotId: null,
  parentId: null,
  vaccineName: 'Vacina DEMO X',
  appliedAt: '2026-06-21',
  nextDoseAt: '2026-12-21',
  responsible: 'João',
  notes: null,
  ...over,
});

/** Libera os limites do plano para os testes que nao sao sobre limite. */
async function unlimited(auth: Auth) {
  const plan = await prisma.plan.findUniqueOrThrow({ where: { code: 'ENTERPRISE' } });
  await prisma.subscription.update({ where: { farmId: farmOf(auth) }, data: { planId: plan.id } });
}

describe('criacao e edicao de animal', () => {
  it('cria o animal com o id gerado no aparelho', async () => {
    const auth = await registerUser(app);
    const id = randomUUID();
    const [result] = await pushOk(auth, [op('animal', id, animalData())]);

    expect(result).toMatchObject({ result: 'APPLIED' });
    expect(result?.record).toMatchObject({ id, tag: 'BR-001', birthDate: '2023-04-10', version: 1 });

    const stored = await prisma.animal.findUniqueOrThrow({ where: { id } });
    expect(stored.farmId).toBe(farmOf(auth));
  });

  it('edita somente os campos enviados e incrementa a versao', async () => {
    const auth = await registerUser(app);
    const id = randomUUID();
    await pushOk(auth, [op('animal', id, animalData())]);
    const [result] = await pushOk(auth, [op('animal', id, { name: 'Estrela II' }, { baseVersion: 1 })]);

    expect(result?.result).toBe('APPLIED');
    expect(result?.record).toMatchObject({ name: 'Estrela II', tag: 'BR-001', breed: 'Nelore', version: 2 });
  });

  it('rejeita dados invalidos sem gravar nada', async () => {
    const auth = await registerUser(app);
    const id = randomUUID();
    const [result] = await pushOk(auth, [op('animal', id, animalData({ tag: '', species: 'OVINE' }))]);
    expect(result).toMatchObject({ result: 'REJECTED', code: 'VALIDATION' });
    expect(await prisma.animal.findUnique({ where: { id } })).toBeNull();
  });

  it('exclui de forma logica e a exclusao e idempotente', async () => {
    const auth = await registerUser(app);
    const id = randomUUID();
    await pushOk(auth, [op('animal', id, animalData())]);
    const remove = () => pushOk(auth, [op('animal', id, {}, { action: 'DELETE', baseVersion: 1 })]);

    expect((await remove())[0]?.record?.deletedAt).toEqual(expect.any(String));
    expect((await remove())[0]?.result).toBe('APPLIED');
    expect((await prisma.animal.findUniqueOrThrow({ where: { id } })).deletedAt).not.toBeNull();
  });
});

describe('lotes', () => {
  it('cria lote sem nenhum animal individual', async () => {
    const auth = await registerUser(app);
    const id = randomUUID();
    const [result] = await pushOk(auth, [op('lot', id, lotData())]);
    expect(result?.record).toMatchObject({ name: 'Bezerros 2026', declaredQuantity: 2000 });
    expect(await prisma.animal.count({ where: { lotId: id } })).toBe(0);
  });

  it('vincula animal a lote e recusa lote inexistente', async () => {
    const auth = await registerUser(app);
    const lotId = randomUUID();
    const results = await pushOk(auth, [
      op('lot', lotId, lotData()),
      op('animal', randomUUID(), animalData({ lotId })),
      op('animal', randomUUID(), animalData({ tag: 'BR-002', lotId: randomUUID() })),
    ]);
    expect(results.map((r) => r.result)).toEqual(['APPLIED', 'APPLIED', 'REJECTED']);
    expect(results[2]?.code).toBe('INVALID_REFERENCE');
  });
});

describe('vacinacao', () => {
  it('registra vacinacao individual', async () => {
    const auth = await registerUser(app);
    const animalId = randomUUID();
    const results = await pushOk(auth, [
      op('animal', animalId, animalData()),
      op('vaccination', randomUUID(), vaccinationData({ animalId })),
    ]);
    expect(results[1]?.record).toMatchObject({
      animalId,
      vaccineName: 'Vacina DEMO X',
      appliedAt: '2026-06-21',
      nextDoseAt: '2026-12-21',
    });
  });

  it('registra vacinacao do lote e as copias dos animais vinculados', async () => {
    const auth = await registerUser(app);
    const lotId = randomUUID();
    const animals = [randomUUID(), randomUUID()];
    const parentId = randomUUID();

    const results = await pushOk(auth, [
      op('lot', lotId, lotData()),
      ...animals.map((id, i) => op('animal', id, animalData({ tag: `BR-10${i}`, lotId }))),
      op('vaccination', parentId, vaccinationData({ lotId })),
      ...animals.map((animalId) =>
        op('vaccination', randomUUID(), vaccinationData({ animalId, parentId })),
      ),
    ]);
    expect(results.every((r) => r.result === 'APPLIED')).toBe(true);

    expect(await prisma.vaccination.count({ where: { lotId } })).toBe(1);
    const copies = await prisma.vaccination.findMany({ where: { parentId } });
    expect(copies.map((c) => c.animalId).sort()).toEqual([...animals].sort());
  });

  it('recusa registro sem alvo ou com animal e lote ao mesmo tempo', async () => {
    const auth = await registerUser(app);
    const lotId = randomUUID();
    const animalId = randomUUID();
    const results = await pushOk(auth, [
      op('lot', lotId, lotData()),
      op('animal', animalId, animalData()),
      op('vaccination', randomUUID(), vaccinationData()),
      op('vaccination', randomUUID(), vaccinationData({ animalId, lotId })),
    ]);
    expect(results.slice(2).map((r) => r.result)).toEqual(['REJECTED', 'REJECTED']);
  });

  it('registra tratamento preventivo, sintoma e evento', async () => {
    const auth = await registerUser(app);
    const animalId = randomUUID();
    const results = await pushOk(auth, [
      op('animal', animalId, animalData()),
      op('treatment', randomUUID(), {
        animalId,
        lotId: null,
        parentId: null,
        type: 'DEWORMER',
        product: 'Produto DEMO',
        appliedAt: '2026-06-01',
        nextApplicationAt: '2026-09-01',
        responsible: null,
        notes: null,
      }),
      op('symptomRecord', randomUUID(), {
        animalId,
        lotId: null,
        symptomId: null,
        symptomName: 'Tosse',
        observedAt: '2026-06-10',
        intensity: 'MILD',
        responsible: null,
        notes: 'Observado pela manhã',
      }),
      op('healthEvent', randomUUID(), {
        animalId,
        lotId: null,
        type: 'VET_VISIT',
        title: 'Visita de rotina',
        description: null,
        occurredAt: '2026-06-12',
        responsible: null,
      }),
    ]);
    expect(results.map((r) => r.result)).toEqual(['APPLIED', 'APPLIED', 'APPLIED', 'APPLIED']);
  });
});

describe('idempotencia e sincronizacao parcial', () => {
  it('reenviar a mesma operacao nao duplica nem altera de novo', async () => {
    const auth = await registerUser(app);
    const id = randomUUID();
    const create = op('animal', id, animalData());

    const first = await pushOk(auth, [create]);
    const second = await pushOk(auth, [create]);

    expect(second[0]?.result).toBe('APPLIED');
    expect(second[0]?.record?.version).toBe(first[0]?.record?.version);
    expect(await prisma.syncOperation.count({ where: { id: create.opId } })).toBe(1);
    expect(await prisma.animal.count({ where: { id } })).toBe(1);
  });

  it('operacao rejeitada nao impede as demais do mesmo envio', async () => {
    const auth = await registerUser(app);
    const results = await pushOk(auth, [
      op('animal', randomUUID(), animalData({ tag: 'OK-1' })),
      op('animal', randomUUID(), animalData({ tag: '' })),
      op('animal', randomUUID(), animalData({ tag: 'OK-2' })),
    ]);
    expect(results.map((r) => r.result)).toEqual(['APPLIED', 'REJECTED', 'APPLIED']);
    expect(await prisma.animal.count({ where: { farmId: farmOf(auth) } })).toBe(2);
  });

  it('valida o formato do envio', async () => {
    const auth = await registerUser(app);
    const response = await push(app, auth, []);
    expect(response.status).toBe(400);
  });
});

describe('recebimento incremental', () => {
  it('devolve apenas o que mudou depois do cursor, em ordem', async () => {
    const auth = await registerUser(app);
    const a = randomUUID();
    const b = randomUUID();
    await pushOk(auth, [op('animal', a, animalData({ tag: 'A' }))]);

    const first = await pull(auth);
    expect(first.changes.map((c) => c.record.id)).toEqual([a]);
    expect(first.hasMore).toBe(false);

    expect((await pull(auth, first.cursor)).changes).toHaveLength(0);

    await pushOk(auth, [
      op('animal', b, animalData({ tag: 'B' })),
      op('animal', a, { name: 'Renomeado' }, { baseVersion: 1 }),
    ]);
    const second = await pull(auth, first.cursor);
    expect(second.changes.map((c) => c.record.id)).toEqual([b, a]);
    expect(second.cursor).toBeGreaterThan(first.cursor);
  });

  it('pagina resultados grandes sem perder nem repetir registros', async () => {
    const auth = await registerUser(app);
    await unlimited(auth);
    const ids = Array.from({ length: 7 }, () => randomUUID());
    await pushOk(auth, ids.map((id, i) => op('animal', id, animalData({ tag: `P-${i}` }))));

    const seen: string[] = [];
    let cursor = 0;
    let hasMore = true;
    while (hasMore) {
      const page = await pull(auth, cursor, 3);
      seen.push(...page.changes.map((c) => c.record.id));
      cursor = page.cursor;
      hasMore = page.hasMore;
    }
    expect(seen).toEqual(ids);
  });

  it('inclui exclusoes e entidades diferentes na mesma sequencia', async () => {
    const auth = await registerUser(app);
    const lotId = randomUUID();
    const animalId = randomUUID();
    await pushOk(auth, [
      op('lot', lotId, lotData()),
      op('animal', animalId, animalData({ lotId })),
      op('animal', animalId, {}, { action: 'DELETE', baseVersion: 1 }),
    ]);
    const { changes } = await pull(auth);
    expect(changes.map((c) => c.entity)).toEqual(['lot', 'animal']);
    expect(changes[1]?.record.deletedAt).not.toBeNull();
  });
});

describe('conflitos', () => {
  it('edicoes em campos diferentes por dois aparelhos sao ambas preservadas', async () => {
    const auth = await registerUser(app);
    const id = randomUUID();
    await pushOk(auth, [op('animal', id, animalData())]);

    await pushOk(auth, [op('animal', id, { breed: 'Angus' }, { baseVersion: 1 })], 'aparelho-A');
    const [late] = await pushOk(auth, [op('animal', id, { name: 'Mimosa' }, { baseVersion: 1 })], 'aparelho-B');

    expect(late?.record).toMatchObject({ breed: 'Angus', name: 'Mimosa', version: 3 });
  });

  it('edicao do mesmo campo: vale a ultima e o valor sobrescrito fica registrado', async () => {
    const auth = await registerUser(app);
    const id = randomUUID();
    await pushOk(auth, [op('animal', id, animalData())]);

    await pushOk(auth, [op('animal', id, { name: 'Do aparelho A' }, { baseVersion: 1 })], 'aparelho-A');
    const stale = op('animal', id, { name: 'Do aparelho B' }, { baseVersion: 1 });
    const [late] = await pushOk(auth, [stale], 'aparelho-B');

    expect(late).toMatchObject({ result: 'CONFLICT', code: 'OVERWRITE' });
    expect(late?.record).toMatchObject({ name: 'Do aparelho B' });

    const audit = await prisma.syncOperation.findUniqueOrThrow({ where: { id: stale.opId } });
    expect(audit.detail).toMatchObject({ previous: { name: 'Do aparelho A' } });
  });

  it('varias edicoes do mesmo aparelho no mesmo envio nao contam como conflito', async () => {
    const auth = await registerUser(app);
    const id = randomUUID();
    const results = await pushOk(auth, [
      op('animal', id, animalData()),
      op('animal', id, { name: 'Primeira' }),
      op('animal', id, { name: 'Segunda' }),
    ]);
    expect(results.map((r) => r.result)).toEqual(['APPLIED', 'APPLIED', 'APPLIED']);
    expect(results[2]?.record).toMatchObject({ name: 'Segunda', version: 3 });
  });

  it('editar um registro excluido em outro aparelho e rejeitado', async () => {
    const auth = await registerUser(app);
    const id = randomUUID();
    await pushOk(auth, [op('animal', id, animalData())]);
    await pushOk(auth, [op('animal', id, {}, { action: 'DELETE', baseVersion: 1 })], 'aparelho-A');

    const [late] = await pushOk(auth, [op('animal', id, { name: 'Tarde demais' }, { baseVersion: 1 })], 'aparelho-B');
    expect(late).toMatchObject({ result: 'REJECTED', code: 'RECORD_DELETED' });
  });
});

describe('isolamento entre organizacoes na sincronizacao', () => {
  it('nao envia para a fazenda de outro usuario', async () => {
    const ana = await registerUser(app);
    const bruno = await registerUser(app);
    const response = await push(app, ana, [op('animal', randomUUID(), animalData())], 'x', farmOf(bruno));
    expect(response.status).toBe(404);
    expect(await prisma.animal.count({ where: { farmId: farmOf(bruno) } })).toBe(0);
  });

  it('nao recebe dados da fazenda de outro usuario', async () => {
    const ana = await registerUser(app);
    const bruno = await registerUser(app);
    await pushOk(bruno, [op('animal', randomUUID(), animalData())]);

    await request(app)
      .get(`/v1/farms/${farmOf(bruno)}/sync/pull`)
      .set(bearer(ana.accessToken))
      .expect(404);
    expect((await pull(ana)).changes).toHaveLength(0);
  });

  it('nao altera registro de outra fazenda reutilizando o id', async () => {
    const ana = await registerUser(app);
    const bruno = await registerUser(app);
    const id = randomUUID();
    await pushOk(bruno, [op('animal', id, animalData({ name: 'Do Bruno' }))]);

    const [attack] = await pushOk(ana, [op('animal', id, { name: 'Invadido' }, { baseVersion: 1 })]);
    expect(attack?.result).toBe('REJECTED');
    expect(attack?.record).toBeUndefined();
    expect((await prisma.animal.findUniqueOrThrow({ where: { id } })).name).toBe('Do Bruno');
  });

  it('nao referencia lote de outra fazenda', async () => {
    const ana = await registerUser(app);
    const bruno = await registerUser(app);
    const lotId = randomUUID();
    await pushOk(bruno, [op('lot', lotId, lotData())]);
    const [result] = await pushOk(ana, [op('animal', randomUUID(), animalData({ lotId }))]);
    expect(result).toMatchObject({ result: 'REJECTED', code: 'INVALID_REFERENCE' });
  });
});

describe('limites do plano', () => {
  it('o plano gratuito recusa lotes alem do limite e explica o motivo', async () => {
    const auth = await registerUser(app);
    const limit = auth.farms[0]?.subscription.limits.maxLots as number;
    const operations = Array.from({ length: limit + 1 }, (_, i) =>
      op('lot', randomUUID(), lotData({ name: `Lote ${i}` })),
    );
    const results = await pushOk(auth, operations);

    expect(results.slice(0, limit).every((r) => r.result === 'APPLIED')).toBe(true);
    expect(results[limit]).toMatchObject({ result: 'REJECTED', code: 'PLAN_LIMIT' });
    expect(results[limit]?.message).toContain(String(limit));
  });

  it('registros excluidos nao contam para o limite', async () => {
    const auth = await registerUser(app);
    const limit = auth.farms[0]?.subscription.limits.maxLots as number;
    const ids = Array.from({ length: limit }, () => randomUUID());
    await pushOk(auth, ids.map((id, i) => op('lot', id, lotData({ name: `Lote ${i}` }))));
    await pushOk(auth, [op('lot', ids[0] as string, {}, { action: 'DELETE', baseVersion: 1 })]);

    const [result] = await pushOk(auth, [op('lot', randomUUID(), lotData({ name: 'Novo' }))]);
    expect(result?.result).toBe('APPLIED');
  });
});

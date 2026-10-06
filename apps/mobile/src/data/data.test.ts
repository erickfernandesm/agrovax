import { computeAlerts, addDays, todayIso, type EntityData } from '@agrovax/shared';
import { beforeEach, describe, expect, it } from 'vitest';
import { registerVaccination, removeHealthRecord, removeLot } from './operations';
import { MemoryAdapter } from './store/adapter';
import { LocalStore, ValidationError } from './store/LocalStore';
import { SyncEngine } from './sync/SyncEngine';
import { FakeServer } from './testing/FakeServer';

const FARM = '11111111-1111-4111-8111-111111111111';
// crypto.randomUUID existe no Node (testes); no app o id vem do expo-crypto.
const randomUUID = () => (globalThis as unknown as { crypto: { randomUUID(): string } }).crypto.randomUUID();
const deps = { newId: randomUUID, now: () => new Date() };

const animal = (over: Partial<EntityData['animal']> = {}): EntityData['animal'] => ({
  lotId: null,
  tag: 'BR-001',
  name: 'Estrela',
  species: 'BOVINE',
  sex: 'FEMALE',
  birthDate: null,
  breed: null,
  category: 'COW',
  purpose: 'BEEF',
  ownerName: null,
  status: 'ACTIVE',
  notes: null,
  ...over,
});

const lot = (over: Partial<EntityData['lot']> = {}): EntityData['lot'] => ({
  name: 'Bezerros 2026',
  declaredQuantity: 2000,
  species: 'BOVINE',
  category: 'CALF',
  purpose: 'BEEF',
  ageRange: null,
  location: null,
  notes: null,
  ...over,
});

const dose = (over: Record<string, unknown> = {}) => ({
  vaccineName: 'Vacina DEMO X',
  appliedAt: '2026-06-21',
  nextDoseAt: null,
  responsible: null,
  notes: null,
  ...over,
});

interface Device {
  adapter: MemoryAdapter;
  store: LocalStore;
  engine: SyncEngine;
  online: boolean;
  /** Novas tentativas agendadas pelo motor (executadas manualmente nos testes). */
  scheduled: (() => void)[];
}

async function createDevice(server: FakeServer, name: string, adapter = new MemoryAdapter()): Promise<Device> {
  const store = await LocalStore.open(FARM, adapter, deps);
  const device: Device = { adapter, store, online: true, scheduled: [], engine: undefined as never };
  device.engine = new SyncEngine(store, server, {
    deviceId: name,
    isOnline: () => device.online,
    pushBatchSize: 3,
    pullPageSize: 4,
    schedule: (callback) => {
      device.scheduled.push(callback);
      return () => undefined;
    },
  });
  return device;
}

let server: FakeServer;
let phone: Device;

beforeEach(async () => {
  server = new FakeServer();
  phone = await createDevice(server, 'celular');
});

describe('funcionamento offline', () => {
  beforeEach(() => {
    phone.online = false;
    server.offline = true;
  });

  it('cadastra, edita e consulta sem internet', async () => {
    const created = await phone.store.create('animal', animal());
    await phone.store.update('animal', created.id, { name: 'Estrela II' });
    await phone.engine.sync();

    expect(phone.store.get('animal', created.id)).toMatchObject({ name: 'Estrela II', version: 0 });
    expect(phone.store.all('animal')).toHaveLength(1);
    expect(phone.engine.getStatus()).toMatchObject({ state: 'OFFLINE', pending: 1 });
    expect(server.count('animal')).toBe(0);
  });

  it('registra lote, vacinacao e sintoma sem internet', async () => {
    const herd = await phone.store.create('lot', lot());
    await registerVaccination(phone.store, { type: 'lot', id: herd.id }, dose());
    const cow = await phone.store.create('animal', animal());
    await phone.store.create('symptomRecord', {
      animalId: cow.id,
      lotId: null,
      symptomId: null,
      symptomName: 'Tosse',
      observedAt: '2026-06-21',
      intensity: 'MILD',
      responsible: null,
      notes: null,
    });
    expect(phone.store.all('vaccination')).toHaveLength(1);
    expect(phone.store.all('symptomRecord')).toHaveLength(1);
    expect(phone.store.pendingOps).toHaveLength(4);
  });

  it('os dados e a fila sobrevivem ao fechamento do app', async () => {
    const created = await phone.store.create('animal', animal());
    const reopened = await LocalStore.open(FARM, phone.adapter, deps);
    expect(reopened.get('animal', created.id)).toMatchObject({ tag: 'BR-001' });
    expect(reopened.pendingOps).toHaveLength(1);
  });

  it('os alertas sao calculados com os dados locais', async () => {
    const herd = await phone.store.create('lot', lot());
    const today = todayIso();
    await registerVaccination(
      phone.store,
      { type: 'lot', id: herd.id },
      dose({ appliedAt: addDays(today, -170), nextDoseAt: addDays(today, 10) }),
    );
    const alerts = computeAlerts(
      {
        animals: phone.store.all('animal'),
        lots: phone.store.all('lot'),
        vaccinations: phone.store.all('vaccination'),
        treatments: phone.store.all('treatment'),
      },
      today,
    );
    expect(alerts).toHaveLength(1);
    expect(alerts[0]?.message).toContain('Lote Bezerros 2026 precisa de reforço');
  });

  it('recusa dados invalidos antes de gravar', async () => {
    await expect(phone.store.create('animal', animal({ tag: '' }))).rejects.toBeInstanceOf(ValidationError);
    expect(phone.store.all('animal')).toHaveLength(0);
    expect(phone.store.pendingOps).toHaveLength(0);
  });

  it('se a gravacao em disco falhar, nada fica pela metade', async () => {
    phone.adapter.failNextWrite = true;
    await expect(phone.store.create('animal', animal())).rejects.toThrow();
    expect(phone.store.all('animal')).toHaveLength(0);
    expect(phone.store.pendingOps).toHaveLength(0);
  });
});

describe('reconexao', () => {
  it('envia a fila quando a internet volta, mantendo os mesmos ids', async () => {
    phone.online = false;
    server.offline = true;
    const cow = await phone.store.create('animal', animal());
    const herd = await phone.store.create('lot', lot());
    await phone.engine.sync();
    expect(phone.engine.getStatus().state).toBe('OFFLINE');

    phone.online = true;
    server.offline = false;
    phone.engine.connectivityChanged();
    await phone.engine.sync();

    expect(server.find(cow.id)).toMatchObject({ tag: 'BR-001', version: 1 });
    expect(server.find(herd.id)).toMatchObject({ name: 'Bezerros 2026' });
    expect(phone.store.get('animal', cow.id)?.version).toBe(1);
    expect(phone.engine.getStatus()).toMatchObject({ state: 'SYNCED', pending: 0, failed: 0 });
    expect(phone.engine.getStatus().lastSyncAt).toEqual(expect.any(String));
  });

  it('edicoes feitas offline sobre o mesmo registro viram um unico envio', async () => {
    const cow = await phone.store.create('animal', animal());
    await phone.store.update('animal', cow.id, { name: 'A' });
    await phone.store.update('animal', cow.id, { name: 'B', breed: 'Nelore' });
    expect(phone.store.pendingOps).toHaveLength(1);

    await phone.engine.sync();
    expect(server.find(cow.id)).toMatchObject({ name: 'B', breed: 'Nelore', version: 1 });
  });

  it('envia filas grandes em lotes, na ordem em que foram criadas', async () => {
    const herd = await phone.store.create('lot', lot());
    for (let i = 0; i < 7; i += 1) {
      await phone.store.create('animal', animal({ tag: `A-${i}`, lotId: herd.id }));
    }
    await phone.engine.sync();
    expect(server.pushCalls).toBe(3);
    expect(server.count('animal')).toBe(7);
    expect(phone.store.pendingOps).toHaveLength(0);
  });
});

describe('falhas de conexao e duplicidade', () => {
  it('falha de rede nao apaga nada e agenda nova tentativa', async () => {
    const cow = await phone.store.create('animal', animal());
    server.offline = true;
    await phone.engine.sync();

    expect(phone.store.get('animal', cow.id)).not.toBeNull();
    expect(phone.store.pendingOps).toHaveLength(1);
    expect(phone.engine.getStatus().state).toBe('ERROR');
    expect(phone.scheduled).toHaveLength(1);

    server.offline = false;
    phone.scheduled[0]?.();
    await phone.engine.sync();
    expect(phone.engine.getStatus().state).toBe('SYNCED');
    expect(server.count('animal')).toBe(1);
  });

  it('resposta perdida: o reenvio nao duplica o registro', async () => {
    const cow = await phone.store.create('animal', animal());
    server.loseNextResponse = true;
    await phone.engine.sync();

    // O servidor aplicou, mas o aparelho nao soube.
    expect(server.count('animal')).toBe(1);
    expect(phone.store.pendingOps).toHaveLength(1);

    await phone.engine.sync();
    expect(server.count('animal')).toBe(1);
    expect(server.appliedOperations).toBe(1);
    expect(phone.store.pendingOps).toHaveLength(0);
    expect(phone.store.get('animal', cow.id)?.version).toBe(1);
  });

  it('alteracao feita durante o envio nao se perde', async () => {
    const cow = await phone.store.create('animal', animal());
    const batch = phone.store.takeBatch(10);
    // O usuario edita enquanto a requisicao esta em andamento.
    await phone.store.update('animal', cow.id, { name: 'Editado durante o envio' });
    expect(phone.store.pendingOps).toHaveLength(2);
    phone.store.releaseBatch(batch);

    await phone.engine.sync();
    expect(server.find(cow.id)).toMatchObject({ name: 'Editado durante o envio', version: 2 });
    expect(phone.store.get('animal', cow.id)).toMatchObject({ name: 'Editado durante o envio', version: 2 });
  });
});

describe('sincronizacao parcial e rejeicoes', () => {
  it('o que o servidor recusa fica marcado com o motivo; o resto sincroniza', async () => {
    server.rejectTags.add('RECUSADO');
    const ok = await phone.store.create('animal', animal({ tag: 'ACEITO' }));
    const refused = await phone.store.create('animal', animal({ tag: 'RECUSADO' }));
    await phone.engine.sync();

    expect(server.find(ok.id)).toBeDefined();
    expect(server.find(refused.id)).toBeUndefined();
    // O dado local recusado continua no aparelho.
    expect(phone.store.get('animal', refused.id)).toMatchObject({ tag: 'RECUSADO' });
    expect(phone.store.failedOps).toHaveLength(1);
    expect(phone.store.failedOps[0]?.error).toMatchObject({ code: 'PLAN_LIMIT' });
    expect(phone.engine.getStatus()).toMatchObject({ state: 'ERROR', failed: 1, pending: 0 });
  });

  it('nova tentativa apos resolver o motivo da recusa', async () => {
    server.rejectTags.add('RECUSADO');
    const refused = await phone.store.create('animal', animal({ tag: 'RECUSADO' }));
    await phone.engine.sync();

    // Corrigir o registro recoloca a alteracao na fila, ja com a correcao.
    await phone.store.update('animal', refused.id, { tag: 'CORRIGIDO' });
    expect(phone.store.failedOps).toHaveLength(0);
    expect(phone.store.pendingOps).toHaveLength(1);
    await phone.engine.sync();

    expect(server.find(refused.id)).toMatchObject({ tag: 'CORRIGIDO', version: 1 });
    expect(phone.store.get('animal', refused.id)).toMatchObject({ tag: 'CORRIGIDO', version: 1 });
    expect(phone.engine.getStatus().state).toBe('SYNCED');
  });

  it('tentar de novo sem alterar reenvia com novo id (ex.: apos mudar de plano)', async () => {
    server.rejectTags.add('RECUSADO');
    const refused = await phone.store.create('animal', animal({ tag: 'RECUSADO' }));
    await phone.engine.sync();
    const firstId = phone.store.failedOps[0]?.opId;

    server.rejectTags.clear();
    await phone.store.retryFailed();
    expect(phone.store.pendingOps[0]?.opId).not.toBe(firstId);
    await phone.engine.sync();
    expect(server.find(refused.id)).toMatchObject({ tag: 'RECUSADO', version: 1 });
  });

  it('descartar uma alteracao recusada remove o registro que nunca foi aceito', async () => {
    server.rejectTags.add('RECUSADO');
    const refused = await phone.store.create('animal', animal({ tag: 'RECUSADO' }));
    await phone.engine.sync();

    await phone.store.discardFailed(phone.store.failedOps[0]?.opId as string);
    expect(phone.store.get('animal', refused.id)).toBeNull();
    expect(phone.engine.getStatus().state).toBe('SYNCED');
  });
});

describe('dois aparelhos', () => {
  let tablet: Device;
  beforeEach(async () => {
    tablet = await createDevice(server, 'tablet');
  });

  it('o que um cadastra aparece no outro', async () => {
    const cow = await phone.store.create('animal', animal());
    await phone.engine.sync();
    await tablet.engine.sync();
    expect(tablet.store.get('animal', cow.id)).toMatchObject({ tag: 'BR-001', version: 1 });
  });

  it('recebe em paginas sem perder registros', async () => {
    for (let i = 0; i < 9; i += 1) await phone.store.create('animal', animal({ tag: `A-${i}` }));
    await phone.engine.sync();
    await tablet.engine.sync();
    expect(tablet.store.all('animal')).toHaveLength(9);
  });

  it('exclusao em um aparelho remove do outro', async () => {
    const cow = await phone.store.create('animal', animal());
    await phone.engine.sync();
    await tablet.engine.sync();

    await phone.store.remove('animal', cow.id);
    await phone.engine.sync();
    await tablet.engine.sync();
    expect(tablet.store.get('animal', cow.id)).toBeNull();
  });

  it('edicoes em campos diferentes convergem para o mesmo resultado', async () => {
    const cow = await phone.store.create('animal', animal());
    await phone.engine.sync();
    await tablet.engine.sync();

    await phone.store.update('animal', cow.id, { breed: 'Angus' });
    await tablet.store.update('animal', cow.id, { name: 'Mimosa' });
    await phone.engine.sync();
    await tablet.engine.sync();
    await phone.engine.sync();

    const expected = { breed: 'Angus', name: 'Mimosa', version: 3 };
    expect(phone.store.get('animal', cow.id)).toMatchObject(expected);
    expect(tablet.store.get('animal', cow.id)).toMatchObject(expected);
  });

  it('conflito no mesmo campo: vale o ultimo envio e o usuario e avisado', async () => {
    const cow = await phone.store.create('animal', animal());
    await phone.engine.sync();
    await tablet.engine.sync();

    await phone.store.update('animal', cow.id, { name: 'Do celular' });
    await tablet.store.update('animal', cow.id, { name: 'Do tablet' });
    await phone.engine.sync();
    await tablet.engine.sync();
    await phone.engine.sync();

    expect(phone.store.get('animal', cow.id)?.name).toBe('Do tablet');
    expect(tablet.store.get('animal', cow.id)?.name).toBe('Do tablet');
    expect(tablet.store.notices).toHaveLength(1);
  });

  it('alteracao local pendente nao e sobrescrita pelo que chega do servidor', async () => {
    const cow = await phone.store.create('animal', animal());
    await phone.engine.sync();
    await tablet.engine.sync();

    await phone.store.update('animal', cow.id, { breed: 'Angus' });
    await phone.engine.sync();

    // O tablet tem uma edicao ainda nao enviada e recebe a do celular.
    await tablet.store.update('animal', cow.id, { name: 'Local do tablet' });
    const page = await server.pull(FARM, tablet.store.cursor, 100);
    await tablet.store.applyServerChanges(page.changes, page.cursor);

    expect(tablet.store.get('animal', cow.id)).toMatchObject({ breed: 'Angus', name: 'Local do tablet' });
    expect(tablet.store.pendingOps).toHaveLength(1);
  });

  it('editar o que o outro excluiu: o servidor recusa e o aparelho informa', async () => {
    const cow = await phone.store.create('animal', animal());
    await phone.engine.sync();
    await tablet.engine.sync();

    await phone.store.remove('animal', cow.id);
    await phone.engine.sync();
    await tablet.store.update('animal', cow.id, { name: 'Tarde demais' });
    await tablet.engine.sync();

    expect(tablet.store.failedOps[0]?.error).toMatchObject({ code: 'RECORD_DELETED' });
    expect(tablet.engine.getStatus().state).toBe('ERROR');
  });
});

describe('vacinacao por lote', () => {
  it('lote sem animais individuais gera um unico registro', async () => {
    const herd = await phone.store.create('lot', lot());
    const { copies } = await registerVaccination(phone.store, { type: 'lot', id: herd.id }, dose());
    expect(copies).toBe(0);
    expect(phone.store.all('vaccination')).toHaveLength(1);
  });

  it('cria uma copia para cada animal ativo vinculado ao lote', async () => {
    const herd = await phone.store.create('lot', lot());
    const a = await phone.store.create('animal', animal({ tag: 'A', lotId: herd.id }));
    const b = await phone.store.create('animal', animal({ tag: 'B', lotId: herd.id }));
    await phone.store.create('animal', animal({ tag: 'VENDIDO', lotId: herd.id, status: 'SOLD' }));
    await phone.store.create('animal', animal({ tag: 'FORA' }));

    const { record, copies } = await registerVaccination(phone.store, { type: 'lot', id: herd.id }, dose());
    expect(copies).toBe(2);

    const all = phone.store.all('vaccination');
    expect(all.filter((v) => v.lotId === herd.id)).toHaveLength(1);
    expect(all.filter((v) => v.parentId === record.id).map((v) => v.animalId).sort()).toEqual([a.id, b.id].sort());

    await phone.engine.sync();
    expect(server.count('vaccination')).toBe(3);
    expect(phone.engine.getStatus().state).toBe('SYNCED');
  });

  it('o historico acompanha o animal que muda de lote', async () => {
    const herd = await phone.store.create('lot', lot());
    const cow = await phone.store.create('animal', animal({ lotId: herd.id }));
    await registerVaccination(phone.store, { type: 'lot', id: herd.id }, dose());
    await phone.store.update('animal', cow.id, { lotId: null });
    expect(phone.store.all('vaccination').filter((v) => v.animalId === cow.id)).toHaveLength(1);
  });

  it('excluir o registro do lote exclui as copias individuais', async () => {
    const herd = await phone.store.create('lot', lot());
    await phone.store.create('animal', animal({ lotId: herd.id }));
    const { record } = await registerVaccination(phone.store, { type: 'lot', id: herd.id }, dose());
    await phone.engine.sync();

    await removeHealthRecord(phone.store, 'vaccination', record.id);
    expect(phone.store.all('vaccination')).toHaveLength(0);
    await phone.engine.sync();
    expect(server.count('vaccination')).toBe(0);
  });

  it('excluir o lote mantem os animais, sem lote', async () => {
    const herd = await phone.store.create('lot', lot());
    const cow = await phone.store.create('animal', animal({ lotId: herd.id }));
    await removeLot(phone.store, herd.id);
    expect(phone.store.get('lot', herd.id)).toBeNull();
    expect(phone.store.get('animal', cow.id)).toMatchObject({ lotId: null });
  });
});

import { describe, expect, it } from 'vitest';
import type {
  AnimalRecord,
  LotRecord,
  TreatmentRecord,
  VaccinationRecord,
} from '../sync/entities';
import { validateEntityData } from '../sync/entities';
import { computeAlerts } from './alerts';
import { addDays, daysBetween, formatDateBr, maskDateBr, parseDateBr } from './dates';
import { buildTimeline, computeDashboard, lotHeadcount, planUsage } from './herd';

const TODAY = '2026-06-21';
const meta = (id: string) => ({
  id,
  farmId: 'farm',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  deletedAt: null,
  version: 1,
});

const lot = (id: string, over: Partial<LotRecord> = {}): LotRecord => ({
  ...meta(id),
  name: 'Bezerros 2026',
  declaredQuantity: 100,
  species: 'BOVINE',
  category: 'CALF',
  purpose: 'BEEF',
  ageRange: null,
  location: null,
  notes: null,
  ...over,
});

const animal = (id: string, over: Partial<AnimalRecord> = {}): AnimalRecord => ({
  ...meta(id),
  lotId: null,
  tag: id.toUpperCase(),
  name: null,
  species: 'BOVINE',
  sex: 'FEMALE',
  birthDate: null,
  breed: null,
  category: null,
  purpose: null,
  ownerName: null,
  status: 'ACTIVE',
  notes: null,
  ...over,
});

const vaccination = (id: string, over: Partial<VaccinationRecord> = {}): VaccinationRecord => ({
  ...meta(id),
  animalId: null,
  lotId: 'lot1',
  parentId: null,
  vaccineName: 'Vacina DEMO A',
  appliedAt: '2026-01-10',
  nextDoseAt: null,
  responsible: null,
  notes: null,
  ...over,
});

const treatment = (id: string, over: Partial<TreatmentRecord> = {}): TreatmentRecord => ({
  ...meta(id),
  animalId: null,
  lotId: 'lot1',
  parentId: null,
  type: 'DEWORMER',
  product: 'Produto DEMO',
  appliedAt: '2026-01-10',
  nextApplicationAt: null,
  responsible: null,
  notes: null,
  ...over,
});

const base = { animals: [], lots: [lot('lot1')], vaccinations: [], treatments: [] };

describe('datas', () => {
  it('converte, mascara e calcula diferencas', () => {
    expect(formatDateBr('2026-06-21')).toBe('21/06/2026');
    expect(parseDateBr('21/06/2026')).toBe('2026-06-21');
    expect(parseDateBr('31/02/2026')).toBeNull();
    expect(maskDateBr('21062026')).toBe('21/06/2026');
    expect(maskDateBr('2106')).toBe('21/06');
    expect(daysBetween('2026-06-21', '2026-07-01')).toBe(10);
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
  });
});

describe('alertas de vacinacao', () => {
  const alertsFor = (nextDoseAt: string) =>
    computeAlerts({ ...base, vaccinations: [vaccination('v1', { nextDoseAt })] }, TODAY);

  it('nao alerta com mais de 30 dias de antecedencia', () => {
    expect(alertsFor(addDays(TODAY, 31))).toHaveLength(0);
  });

  it.each([
    [30, 30],
    [16, 30],
    [15, 15],
    [8, 15],
    [7, 7],
    [0, 7],
  ])('faltando %i dias cai na faixa de %i dias', (days, threshold) => {
    const [alert] = alertsFor(addDays(TODAY, days));
    expect(alert).toMatchObject({ kind: 'VACCINATION_DUE', thresholdDays: threshold, daysUntil: days });
  });

  it('marca como vencida depois da data', () => {
    const [alert] = alertsFor(addDays(TODAY, -3));
    expect(alert).toMatchObject({ kind: 'VACCINATION_OVERDUE', thresholdDays: null, daysUntil: -3 });
    expect(alert?.message).toContain('Lote Bezerros 2026 possui vacinação atrasada');
  });

  it('a chave muda quando o alerta troca de faixa', () => {
    const at30 = alertsFor(addDays(TODAY, 20))[0]?.key;
    const at15 = alertsFor(addDays(TODAY, 10))[0]?.key;
    expect(at30).not.toBe(at15);
  });

  it('uma aplicacao posterior da mesma vacina encerra o alerta', () => {
    const alerts = computeAlerts(
      {
        ...base,
        vaccinations: [
          vaccination('v1', { nextDoseAt: addDays(TODAY, -5) }),
          vaccination('v2', { appliedAt: '2026-06-20', vaccineName: ' vacina demo a ' }),
        ],
      },
      TODAY,
    );
    expect(alerts).toHaveLength(0);
  });

  it('copias individuais de um registro de lote nao duplicam o alerta', () => {
    const alerts = computeAlerts(
      {
        ...base,
        animals: [animal('a1', { lotId: 'lot1' })],
        vaccinations: [
          vaccination('v1', { nextDoseAt: addDays(TODAY, 5) }),
          vaccination('v1-a1', { lotId: null, animalId: 'a1', parentId: 'v1', nextDoseAt: addDays(TODAY, 5) }),
        ],
      },
      TODAY,
    );
    expect(alerts).toHaveLength(1);
    expect(alerts[0]?.targetType).toBe('lot');
  });

  it('ignora registros excluidos e animais inativos', () => {
    const alerts = computeAlerts(
      {
        ...base,
        animals: [animal('a1', { status: 'SOLD' })],
        vaccinations: [
          vaccination('v1', { nextDoseAt: addDays(TODAY, 5), deletedAt: '2026-06-01T00:00:00.000Z' }),
          vaccination('v2', { lotId: null, animalId: 'a1', nextDoseAt: addDays(TODAY, 5) }),
        ],
      },
      TODAY,
    );
    expect(alerts).toHaveLength(0);
  });

  it('ordena os mais atrasados primeiro', () => {
    const alerts = computeAlerts(
      {
        ...base,
        vaccinations: [
          vaccination('v1', { vaccineName: 'A', nextDoseAt: addDays(TODAY, 10) }),
          vaccination('v2', { vaccineName: 'B', nextDoseAt: addDays(TODAY, -10) }),
          vaccination('v3', { vaccineName: 'C', nextDoseAt: addDays(TODAY, -1) }),
        ],
      },
      TODAY,
    );
    expect(alerts.map((a) => a.sourceId)).toEqual(['v2', 'v3', 'v1']);
  });
});

describe('alertas de tratamento', () => {
  it('avisa vermifugacao vencendo e vencida', () => {
    const alerts = computeAlerts(
      {
        ...base,
        treatments: [
          treatment('t1', { nextApplicationAt: addDays(TODAY, 10) }),
          treatment('t2', { product: 'Outro DEMO', nextApplicationAt: addDays(TODAY, -2) }),
        ],
      },
      TODAY,
    );
    expect(alerts.map((a) => a.kind)).toEqual(['TREATMENT_OVERDUE', 'TREATMENT_DUE']);
    expect(alerts[1]?.message).toContain('Lote Bezerros 2026 possui Vermífugo (Produto DEMO) vencendo em 10 dias');
  });
});

describe('lotes e contagens', () => {
  it('um lote existe sem animais individualizados', () => {
    expect(lotHeadcount(lot('lot1', { declaredQuantity: 2000 }), [])).toEqual({
      declared: 2000,
      identified: 0,
      effective: 2000,
    });
  });

  it('animais identificados sao parte da quantidade informada, nao somam a ela', () => {
    const animals = [animal('a1', { lotId: 'lot1' }), animal('a2', { lotId: 'lot1' })];
    expect(lotHeadcount(lot('lot1', { declaredQuantity: 100 }), animals).effective).toBe(100);
  });

  it('se houver mais identificados do que o informado, vale a contagem real', () => {
    const animals = [animal('a1', { lotId: 'lot1' }), animal('a2', { lotId: 'lot1' })];
    expect(lotHeadcount(lot('lot1', { declaredQuantity: 1 }), animals).effective).toBe(2);
  });

  it('total da fazenda = cabecas dos lotes + animais sem lote', () => {
    const records = {
      lots: [lot('lot1', { declaredQuantity: 2000 })],
      animals: [
        animal('a1', { lotId: 'lot1' }),
        animal('cavalo1', { species: 'EQUINE' }),
        animal('cavalo2', { species: 'EQUINE' }),
        animal('vendido', { status: 'SOLD' }),
      ],
      vaccinations: [],
      treatments: [],
      symptomRecords: [],
      healthEvents: [],
    };
    const herd = computeDashboard(records, [], 'HERD');
    expect(herd.totalAnimals).toBe(2002);
    expect(herd.viewTotal).toBe(2000);
    expect(computeDashboard(records, [], 'INDIVIDUAL').viewTotal).toBe(3);
  });

  it('separa pendencias por visao', () => {
    const records = {
      lots: [lot('lot1')],
      animals: [animal('a1')],
      vaccinations: [
        vaccination('v1', { nextDoseAt: addDays(TODAY, 5) }),
        vaccination('v2', { lotId: null, animalId: 'a1', nextDoseAt: addDays(TODAY, -1) }),
      ],
      treatments: [],
      symptomRecords: [],
      healthEvents: [],
    };
    const alerts = computeAlerts(records, TODAY);
    expect(computeDashboard(records, alerts, 'HERD')).toMatchObject({ pendingVaccinations: 1, overdue: 0 });
    expect(computeDashboard(records, alerts, 'INDIVIDUAL')).toMatchObject({ pendingVaccinations: 1, overdue: 1 });
  });
});

describe('linha do tempo', () => {
  it('reune os eventos do animal em ordem decrescente e marca os vindos do lote', () => {
    const timeline = buildTimeline(
      { type: 'animal', id: 'a1' },
      {
        animals: [animal('a1')],
        lots: [],
        vaccinations: [
          vaccination('v1', { lotId: null, animalId: 'a1', appliedAt: '2026-03-01' }),
          vaccination('v2', { lotId: null, animalId: 'a1', parentId: 'lote-v', appliedAt: '2026-05-01' }),
          vaccination('outro', { lotId: null, animalId: 'a2' }),
        ],
        treatments: [treatment('t1', { lotId: null, animalId: 'a1', appliedAt: '2026-04-01' })],
        symptomRecords: [],
        healthEvents: [],
      },
    );
    expect(timeline.map((i) => i.id)).toEqual(['v2', 't1', 'v1']);
    expect(timeline[0]?.fromLot).toBe(true);
    expect(timeline[2]?.fromLot).toBe(false);
  });
});

describe('validacao de registros', () => {
  const valid = {
    animalId: null,
    lotId: '3f2b8a1e-4c5d-4e6f-8a9b-0c1d2e3f4a5b',
    parentId: null,
    vaccineName: 'Vacina DEMO',
    appliedAt: '2026-06-21',
    nextDoseAt: '2026-12-21',
    responsible: null,
    notes: null,
  };

  it('aceita vacinacao de lote valida', () => {
    expect(validateEntityData('vaccination', valid).ok).toBe(true);
  });

  it('exige animal OU lote', () => {
    expect(validateEntityData('vaccination', { ...valid, lotId: null }).ok).toBe(false);
    expect(validateEntityData('vaccination', { ...valid, animalId: valid.lotId }).ok).toBe(false);
  });

  it('a proxima dose deve ser posterior a aplicacao', () => {
    const result = validateEntityData('vaccination', { ...valid, nextDoseAt: '2026-06-21' });
    expect(result.errors?.nextDoseAt).toBeDefined();
  });

  it('rejeita data inexistente', () => {
    expect(validateEntityData('vaccination', { ...valid, appliedAt: '2026-02-30' }).ok).toBe(false);
  });
});

describe('uso do plano', () => {
  it('indica quando o limite foi atingido', () => {
    const usage = planUsage(
      { animals: [animal('a1'), animal('a2')], lots: [lot('l1')] },
      { maxAnimals: 2, maxLots: null, maxUsers: 1 },
    );
    expect(usage.animals).toEqual({ used: 2, limit: 2, reached: true });
    expect(usage.lots.reached).toBe(false);
  });
});

describe('notificacoes locais planejadas', () => {
  it('agenda um aviso para cada antecedencia futura e para o dia do vencimento', async () => {
    const { planNotifications } = await import('./alerts');
    const due = addDays(TODAY, 20);
    const planned = planNotifications(
      { ...base, vaccinations: [vaccination('v1', { nextDoseAt: due })] },
      TODAY,
    );
    // Faltam 20 dias: o aviso de 30 dias ja passou; restam 15, 7 e o dia.
    expect(planned.map((p) => p.date)).toEqual([addDays(due, -15), addDays(due, -7), due]);
    expect(planned[0]?.body).toContain('em 15 dias');
    expect(planned[2]?.body).toContain('hoje');
  });

  it('nao agenda nada para itens vencidos ou ja reaplicados', async () => {
    const { planNotifications } = await import('./alerts');
    const planned = planNotifications(
      {
        ...base,
        vaccinations: [
          vaccination('v1', { nextDoseAt: addDays(TODAY, -2) }),
          vaccination('v2', { vaccineName: 'Outra', nextDoseAt: addDays(TODAY, 10) }),
          vaccination('v3', { vaccineName: 'Outra', appliedAt: '2026-06-20' }),
        ],
      },
      TODAY,
    );
    expect(planned).toHaveLength(0);
  });
});

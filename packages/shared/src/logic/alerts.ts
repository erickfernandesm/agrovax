import { VACCINATION_ALERT_THRESHOLDS_DAYS, type AlertKind } from '../domain/enums';
import { TREATMENT_TYPE_LABEL } from '../domain/labels';
import type {
  AnimalRecord,
  LotRecord,
  TreatmentRecord,
  VaccinationRecord,
} from '../sync/entities';
import { addDays, daysBetween, formatDateBr } from './dates';

/**
 * Calculo dos alertas de vacinacao e de tratamentos preventivos.
 *
 * Sao funcoes puras sobre os registros que ja estao no aparelho: por isso os
 * alertas funcionam sem internet. As antecedencias sao 30, 15 e 7 dias, mais
 * o estado "vencido".
 */

export interface FarmRecords {
  animals: readonly AnimalRecord[];
  lots: readonly LotRecord[];
  vaccinations: readonly VaccinationRecord[];
  treatments: readonly TreatmentRecord[];
}

export interface HealthAlert {
  /** Identidade estavel do alerta: muda quando ele passa para a faixa seguinte. */
  key: string;
  kind: AlertKind;
  sourceType: 'vaccination' | 'treatment';
  sourceId: string;
  targetType: 'animal' | 'lot';
  targetId: string;
  targetLabel: string;
  /** Nome da vacina ou do produto. */
  subject: string;
  dueDate: string;
  /** Dias ate o vencimento; negativo quando vencido. */
  daysUntil: number;
  /** Faixa de antecedencia (30, 15 ou 7); null quando vencido. */
  thresholdDays: number | null;
  title: string;
  message: string;
}

/** Vacina ou tratamento com data futura registrada e ainda nao reaplicado. */
interface OpenItem {
  sourceType: 'vaccination' | 'treatment';
  sourceId: string;
  targetType: 'animal' | 'lot';
  targetId: string;
  targetLabel: string;
  subject: string;
  /** Descricao usada nas mensagens de tratamento, ex.: "Vermífugo (Produto)". */
  treatmentLabel: string | null;
  dueDate: string;
}

const normalize = (value: string) => value.trim().toLocaleLowerCase('pt-BR');

export function animalLabel(animal: Pick<AnimalRecord, 'tag' | 'name'>): string {
  return animal.name ? `Animal ${animal.tag} (${animal.name})` : `Animal ${animal.tag}`;
}

export function lotLabel(lot: Pick<LotRecord, 'name'>): string {
  return `Lote ${lot.name}`;
}

function inDays(days: number): string {
  if (days === 0) return 'hoje';
  if (days === 1) return 'amanhã';
  return `em ${days} dias`;
}

function overdueBy(days: number): string {
  return days === 1 ? 'há 1 dia' : `há ${days} dias`;
}

/** Menor faixa (7, 15, 30) que ainda contem o prazo; null se faltar mais de 30 dias. */
function thresholdFor(daysUntil: number): number | null {
  const ascending = [...VACCINATION_ALERT_THRESHOLDS_DAYS].sort((a, b) => a - b);
  return ascending.find((limit) => daysUntil <= limit) ?? null;
}

function openItems(records: FarmRecords): OpenItem[] {
  const animals = new Map(records.animals.filter((a) => !a.deletedAt).map((a) => [a.id, a]));
  const lots = new Map(records.lots.filter((l) => !l.deletedAt).map((l) => [l.id, l]));
  const items: OpenItem[] = [];

  const collect = <R extends VaccinationRecord | TreatmentRecord>(
    sourceType: OpenItem['sourceType'],
    all: readonly R[],
    subjectOf: (record: R) => string,
    dueOf: (record: R) => string | null,
    treatmentLabelOf: (record: R) => string | null,
  ) => {
    const live = all.filter((record) => !record.deletedAt);

    // Ultima aplicacao de cada produto em cada alvo: uma aplicacao posterior
    // do mesmo produto encerra o alerta da anterior.
    const latest = new Map<string, string>();
    const groupKey = (record: R) =>
      `${record.animalId ?? ''}|${record.lotId ?? ''}|${normalize(subjectOf(record))}`;
    for (const record of live) {
      const key = groupKey(record);
      const current = latest.get(key);
      if (!current || record.appliedAt > current) latest.set(key, record.appliedAt);
    }

    for (const record of live) {
      const dueDate = dueOf(record);
      // Copias individuais de um registro de lote nao geram alerta proprio:
      // o alerta e do lote.
      if (!dueDate || record.parentId) continue;
      if ((latest.get(groupKey(record)) ?? '') > record.appliedAt) continue;

      let target: Pick<OpenItem, 'targetType' | 'targetId' | 'targetLabel'> | null = null;
      if (record.animalId) {
        const animal = animals.get(record.animalId);
        if (animal && animal.status === 'ACTIVE') {
          target = { targetType: 'animal', targetId: animal.id, targetLabel: animalLabel(animal) };
        }
      } else if (record.lotId) {
        const lot = lots.get(record.lotId);
        if (lot) target = { targetType: 'lot', targetId: lot.id, targetLabel: lotLabel(lot) };
      }
      if (!target) continue;

      items.push({
        ...target,
        sourceType,
        sourceId: record.id,
        subject: subjectOf(record),
        treatmentLabel: treatmentLabelOf(record),
        dueDate,
      });
    }
  };

  collect(
    'vaccination',
    records.vaccinations,
    (v) => v.vaccineName,
    (v) => v.nextDoseAt,
    () => null,
  );
  collect(
    'treatment',
    records.treatments,
    (t) => t.product,
    (t) => t.nextApplicationAt,
    (t) => `${TREATMENT_TYPE_LABEL[t.type]} (${t.product})`,
  );
  return items;
}

function describe(item: OpenItem, daysUntil: number): { title: string; message: string } {
  const date = formatDateBr(item.dueDate);
  if (item.sourceType === 'vaccination') {
    return daysUntil < 0
      ? {
          title: 'Vacinação atrasada',
          message: `${item.targetLabel} possui vacinação atrasada: ${item.subject} venceu ${overdueBy(-daysUntil)} (${date}).`,
        }
      : {
          title: 'Vacina próxima',
          message: `${item.targetLabel} precisa de reforço da vacina ${item.subject} ${inDays(daysUntil)} (${date}).`,
        };
  }
  return daysUntil < 0
    ? {
        title: 'Tratamento atrasado',
        message: `${item.targetLabel} está com tratamento pendente: ${item.treatmentLabel} venceu ${overdueBy(-daysUntil)} (${date}).`,
      }
    : {
        title: 'Tratamento próximo',
        message: `${item.targetLabel} possui ${item.treatmentLabel} vencendo ${inDays(daysUntil)} (${date}).`,
      };
}

export function computeAlerts(records: FarmRecords, today: string): HealthAlert[] {
  const alerts: HealthAlert[] = [];

  for (const item of openItems(records)) {
    const daysUntil = daysBetween(today, item.dueDate);
    const overdue = daysUntil < 0;
    const thresholdDays = overdue ? null : thresholdFor(daysUntil);
    if (!overdue && thresholdDays === null) continue;

    const kind: AlertKind =
      item.sourceType === 'vaccination'
        ? overdue
          ? 'VACCINATION_OVERDUE'
          : 'VACCINATION_DUE'
        : overdue
          ? 'TREATMENT_OVERDUE'
          : 'TREATMENT_DUE';

    alerts.push({
      key: `${item.sourceType}:${item.sourceId}:${overdue ? 'OVERDUE' : thresholdDays}`,
      kind,
      sourceType: item.sourceType,
      sourceId: item.sourceId,
      targetType: item.targetType,
      targetId: item.targetId,
      targetLabel: item.targetLabel,
      subject: item.subject,
      dueDate: item.dueDate,
      daysUntil,
      thresholdDays,
      ...describe(item, daysUntil),
    });
  }

  // Vencidos primeiro (os mais atrasados no topo), depois os mais proximos.
  return alerts.sort((a, b) => a.daysUntil - b.daysUntil);
}

export function isOverdue(alert: HealthAlert): boolean {
  return alert.daysUntil < 0;
}

// ------------------------------------------------------ notificacoes locais

export interface PlannedNotification {
  /** Identidade estavel: registro de origem + antecedencia. */
  id: string;
  /** Dia em que a notificacao deve aparecer. */
  date: string;
  title: string;
  body: string;
}

/** Antecedencias das notificacoes: as dos alertas e o proprio dia do vencimento. */
const NOTIFICATION_OFFSETS_DAYS = [...VACCINATION_ALERT_THRESHOLDS_DAYS, 0];

/**
 * Notificacoes locais a agendar no aparelho, a partir das datas ja
 * registradas. Como sao agendadas no proprio aparelho, disparam sem internet.
 * Devolve apenas dias futuros, dos mais proximos para os mais distantes.
 */
export function planNotifications(
  records: FarmRecords,
  today: string,
  limit = 40,
): PlannedNotification[] {
  const planned: PlannedNotification[] = [];
  for (const item of openItems(records)) {
    for (const offset of NOTIFICATION_OFFSETS_DAYS) {
      const date = addDays(item.dueDate, -offset);
      if (date <= today) continue;
      const { title, message } = describe(item, offset);
      planned.push({
        id: `${item.sourceType}:${item.sourceId}:${offset}`,
        date,
        title: `AgroVax: ${title.toLowerCase()}`,
        body: message,
      });
    }
  }
  return planned.sort((a, b) => a.date.localeCompare(b.date)).slice(0, limit);
}

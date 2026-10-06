import { HEALTH_EVENT_TYPES, type HealthEventType } from '../domain/enums';
import { SYMPTOM_INTENSITY_LABEL, TREATMENT_TYPE_LABEL } from '../domain/labels';
import type {
  AnimalRecord,
  HealthEventRecord,
  LotRecord,
  SymptomRecordRecord,
  TreatmentRecord,
  VaccinationRecord,
} from '../sync/entities';
import type { DiseaseDto } from '../types/catalog';
import type { PlanLimits } from '../types/api';
import type { HealthAlert } from './alerts';

/** Regras de leitura do rebanho: contagens, indicadores e linha do tempo. */

export interface HerdRecords {
  animals: readonly AnimalRecord[];
  lots: readonly LotRecord[];
  vaccinations: readonly VaccinationRecord[];
  treatments: readonly TreatmentRecord[];
  symptomRecords: readonly SymptomRecordRecord[];
  healthEvents: readonly HealthEventRecord[];
}

const alive = <T extends { deletedAt: string | null }>(items: readonly T[]) =>
  items.filter((item) => !item.deletedAt);

export function activeAnimals(animals: readonly AnimalRecord[]): AnimalRecord[] {
  return alive(animals).filter((animal) => animal.status === 'ACTIVE');
}

/** Animais ativos cadastrados individualmente e vinculados ao lote. */
export function identifiedInLot(lotId: string, animals: readonly AnimalRecord[]): AnimalRecord[] {
  return activeAnimals(animals).filter((animal) => animal.lotId === lotId);
}

/**
 * Cabecas do lote. A quantidade informada pelo produtor vale, a menos que
 * haja mais animais identificados do que o informado: nesse caso vale a
 * contagem real, e a interface sugere corrigir a quantidade.
 */
export function lotHeadcount(lot: LotRecord, animals: readonly AnimalRecord[]): {
  declared: number;
  identified: number;
  effective: number;
} {
  const identified = identifiedInLot(lot.id, animals).length;
  return {
    declared: lot.declaredQuantity,
    identified,
    effective: Math.max(lot.declaredQuantity, identified),
  };
}

export type DashboardView = 'INDIVIDUAL' | 'HERD';

export interface DashboardStats {
  /** Total de cabecas da fazenda (lotes + animais sem lote). */
  totalAnimals: number;
  /** Total da visao selecionada (animais individuais ou cabecas em lotes). */
  viewTotal: number;
  individualCount: number;
  lotCount: number;
  pendingVaccinations: number;
  pendingTreatments: number;
  overdue: number;
  recentVaccinations: VaccinationRecord[];
}

export function computeDashboard(
  records: HerdRecords,
  alerts: readonly HealthAlert[],
  view: DashboardView,
): DashboardStats {
  const lots = alive(records.lots);
  const liveLotIds = new Set(lots.map((lot) => lot.id));
  const animals = activeAnimals(records.animals);

  const inLots = lots.reduce((sum, lot) => sum + lotHeadcount(lot, records.animals).effective, 0);
  const withoutLot = animals.filter((a) => !a.lotId || !liveLotIds.has(a.lotId)).length;

  const targetType = view === 'INDIVIDUAL' ? 'animal' : 'lot';
  const viewAlerts = alerts.filter((alert) => alert.targetType === targetType);

  const recentVaccinations = alive(records.vaccinations)
    .filter((v) => (view === 'INDIVIDUAL' ? v.animalId !== null : v.lotId !== null))
    .sort((a, b) => b.appliedAt.localeCompare(a.appliedAt) || b.createdAt.localeCompare(a.createdAt))
    .slice(0, 5);

  return {
    totalAnimals: inLots + withoutLot,
    viewTotal: view === 'INDIVIDUAL' ? animals.length : inLots,
    individualCount: animals.length,
    lotCount: lots.length,
    pendingVaccinations: viewAlerts.filter((a) => a.sourceType === 'vaccination').length,
    pendingTreatments: viewAlerts.filter((a) => a.sourceType === 'treatment').length,
    overdue: viewAlerts.filter((a) => a.daysUntil < 0).length,
    recentVaccinations,
  };
}

// --------------------------------------------------------- linha do tempo

export type TimelineKind = 'vaccination' | 'treatment' | 'symptom' | 'event';

export interface TimelineItem {
  id: string;
  kind: TimelineKind;
  date: string;
  title: string;
  subtitle: string | null;
  notes: string | null;
  responsible: string | null;
  /** Data da proxima dose/aplicacao, quando houver. */
  nextDate: string | null;
  /** O registro veio de uma aplicacao feita no lote inteiro. */
  fromLot: boolean;
}

export const HEALTH_EVENT_TYPE_LABEL: Record<HealthEventType, string> = {
  EXAM: 'Exame',
  VET_VISIT: 'Visita do veterinário',
  NOTE: 'Anotação',
  OTHER: 'Outro',
};
export { HEALTH_EVENT_TYPES };

export function buildTimeline(
  target: { type: 'animal' | 'lot'; id: string },
  records: HerdRecords,
): TimelineItem[] {
  const belongs = (record: { animalId: string | null; lotId: string | null; deletedAt: string | null }) =>
    !record.deletedAt &&
    (target.type === 'animal' ? record.animalId === target.id : record.lotId === target.id);

  const items: TimelineItem[] = [
    ...records.vaccinations.filter(belongs).map(
      (v): TimelineItem => ({
        id: v.id,
        kind: 'vaccination',
        date: v.appliedAt,
        title: `Vacina: ${v.vaccineName}`,
        subtitle: null,
        notes: v.notes,
        responsible: v.responsible,
        nextDate: v.nextDoseAt,
        fromLot: v.parentId !== null,
      }),
    ),
    ...records.treatments.filter(belongs).map(
      (t): TimelineItem => ({
        id: t.id,
        kind: 'treatment',
        date: t.appliedAt,
        title: `${TREATMENT_TYPE_LABEL[t.type]}: ${t.product}`,
        subtitle: null,
        notes: t.notes,
        responsible: t.responsible,
        nextDate: t.nextApplicationAt,
        fromLot: t.parentId !== null,
      }),
    ),
    ...records.symptomRecords.filter(belongs).map(
      (s): TimelineItem => ({
        id: s.id,
        kind: 'symptom',
        date: s.observedAt,
        title: `Sintoma: ${s.symptomName}`,
        subtitle: s.intensity ? `Intensidade ${SYMPTOM_INTENSITY_LABEL[s.intensity].toLowerCase()}` : null,
        notes: s.notes,
        responsible: s.responsible,
        nextDate: null,
        fromLot: false,
      }),
    ),
    ...records.healthEvents.filter(belongs).map(
      (e): TimelineItem => ({
        id: e.id,
        kind: 'event',
        date: e.occurredAt,
        title: e.title,
        subtitle: HEALTH_EVENT_TYPE_LABEL[e.type],
        notes: e.description,
        responsible: e.responsible,
        nextDate: null,
        fromLot: false,
      }),
    ),
  ];

  return items.sort((a, b) => b.date.localeCompare(a.date));
}

// ------------------------------------------------------ sintomas e doencas

/** Texto obrigatorio sempre que o app relaciona um sintoma a doencas. */
export const SYMPTOM_ASSOCIATION_NOTICE =
  'Este sintoma pode estar associado a algumas condições. O AgroVax não faz diagnóstico: procure orientação de um médico-veterinário.';

/** Doencas do catalogo que listam o sintoma. Informacao educativa, nunca diagnostico. */
export function diseasesForSymptom(symptomId: string, diseases: readonly DiseaseDto[]): DiseaseDto[] {
  return diseases.filter((disease) => disease.symptomIds.includes(symptomId));
}

// ------------------------------------------------------------- plano

export interface PlanUsage {
  animals: { used: number; limit: number | null; reached: boolean };
  lots: { used: number; limit: number | null; reached: boolean };
}

export function planUsage(
  records: Pick<HerdRecords, 'animals' | 'lots'>,
  limits: PlanLimits,
): PlanUsage {
  const animals = alive(records.animals).length;
  const lots = alive(records.lots).length;
  return {
    animals: {
      used: animals,
      limit: limits.maxAnimals,
      reached: limits.maxAnimals !== null && animals >= limits.maxAnimals,
    },
    lots: {
      used: lots,
      limit: limits.maxLots,
      reached: limits.maxLots !== null && lots >= limits.maxLots,
    },
  };
}

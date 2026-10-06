import { z } from 'zod';
import {
  ANIMAL_STATUSES,
  CATEGORIES,
  HEALTH_EVENT_TYPES,
  PURPOSES,
  SEXES,
  SPECIES,
  SYMPTOM_INTENSITIES,
  TREATMENT_TYPES,
} from '../domain/enums';
import { isValidIsoDate } from '../logic/dates';

/**
 * Registros sincronizaveis do produtor.
 *
 * Estes schemas sao a unica definicao dos campos de cada registro: o app os
 * usa para validar antes de gravar localmente e a API para validar o que
 * chega pela sincronizacao.
 */

const id = z.uuid();
const optionalId = id.nullable();
const text = (max: number) => z.string().trim().min(1, 'Campo obrigatório.').max(max);
const optionalText = (max: number) => z.string().trim().max(max).nullable();
const date = z.string().refine(isValidIsoDate, 'Data inválida.');
const optionalDate = date.nullable();

export const animalDataSchema = z.object({
  lotId: optionalId,
  tag: text(40),
  name: optionalText(80),
  species: z.enum(SPECIES),
  sex: z.enum(SEXES),
  birthDate: optionalDate,
  breed: optionalText(80),
  category: z.enum(CATEGORIES).nullable(),
  purpose: z.enum(PURPOSES).nullable(),
  ownerName: optionalText(120),
  status: z.enum(ANIMAL_STATUSES),
  notes: optionalText(1000),
});

export const lotDataSchema = z.object({
  name: text(80),
  declaredQuantity: z.number().int().min(0, 'Informe a quantidade.').max(1_000_000),
  species: z.enum(SPECIES),
  category: z.enum(CATEGORIES).nullable(),
  purpose: z.enum(PURPOSES).nullable(),
  ageRange: optionalText(60),
  location: optionalText(120),
  notes: optionalText(1000),
});

/** Campos comuns aos registros que apontam para um animal OU um lote. */
const target = {
  animalId: optionalId,
  lotId: optionalId,
};

export const vaccinationDataSchema = z.object({
  ...target,
  /** Registro do lote que originou esta copia individual. */
  parentId: optionalId,
  vaccineName: text(120),
  appliedAt: date,
  nextDoseAt: optionalDate,
  responsible: optionalText(120),
  notes: optionalText(1000),
});

export const treatmentDataSchema = z.object({
  ...target,
  parentId: optionalId,
  type: z.enum(TREATMENT_TYPES),
  product: text(120),
  appliedAt: date,
  nextApplicationAt: optionalDate,
  responsible: optionalText(120),
  notes: optionalText(1000),
});

export const symptomRecordDataSchema = z.object({
  ...target,
  symptomId: optionalId,
  symptomName: text(120),
  observedAt: date,
  intensity: z.enum(SYMPTOM_INTENSITIES).nullable(),
  responsible: optionalText(120),
  notes: optionalText(1000),
});

export const healthEventDataSchema = z.object({
  ...target,
  type: z.enum(HEALTH_EVENT_TYPES),
  title: text(120),
  description: optionalText(1000),
  occurredAt: date,
  responsible: optionalText(120),
});

export const ENTITY_SCHEMAS = {
  animal: animalDataSchema,
  lot: lotDataSchema,
  vaccination: vaccinationDataSchema,
  treatment: treatmentDataSchema,
  symptomRecord: symptomRecordDataSchema,
  healthEvent: healthEventDataSchema,
} as const;

export type EntityName = keyof typeof ENTITY_SCHEMAS;

/**
 * Ordem de dependencia: um registro so referencia entidades anteriores
 * (animal -> lote; registros sanitarios -> animal/lote).
 */
export const ENTITY_NAMES = [
  'lot',
  'animal',
  'vaccination',
  'treatment',
  'symptomRecord',
  'healthEvent',
] as const satisfies readonly EntityName[];

/** Entidades que apontam para animal OU lote. */
export const TARGETED_ENTITIES: readonly EntityName[] = [
  'vaccination',
  'treatment',
  'symptomRecord',
  'healthEvent',
];

export type EntityData = { [K in EntityName]: z.infer<(typeof ENTITY_SCHEMAS)[K]> };

/** Campos de controle presentes em todo registro sincronizavel. */
export interface RecordMeta {
  id: string;
  farmId: string;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  /** Versao no servidor; 0 enquanto o registro so existe no aparelho. */
  version: number;
}

export type EntityRecord<K extends EntityName = EntityName> = EntityData[K] & RecordMeta;

export type AnimalRecord = EntityRecord<'animal'>;
export type LotRecord = EntityRecord<'lot'>;
export type VaccinationRecord = EntityRecord<'vaccination'>;
export type TreatmentRecord = EntityRecord<'treatment'>;
export type SymptomRecordRecord = EntityRecord<'symptomRecord'>;
export type HealthEventRecord = EntityRecord<'healthEvent'>;

export interface ValidationResult<T> {
  ok: boolean;
  data?: T;
  /** Primeira mensagem de erro por campo. */
  errors?: Record<string, string>;
}

/**
 * Valida os dados completos de um registro, incluindo as regras entre campos
 * que o schema sozinho nao expressa.
 */
export function validateEntityData<K extends EntityName>(
  entity: K,
  input: unknown,
): ValidationResult<EntityData[K]> {
  const parsed = ENTITY_SCHEMAS[entity].safeParse(input);
  if (!parsed.success) {
    const errors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path.join('.') || '_';
      if (!(key in errors)) errors[key] = issue.message;
    }
    return { ok: false, errors };
  }

  const data = parsed.data as EntityData[K];
  const errors: Record<string, string> = {};

  if (TARGETED_ENTITIES.includes(entity)) {
    const { animalId, lotId } = data as { animalId: string | null; lotId: string | null };
    if ((animalId === null) === (lotId === null)) {
      errors._ = 'O registro deve pertencer a um animal ou a um lote.';
    }
  }
  if (entity === 'vaccination') {
    const v = data as EntityData['vaccination'];
    if (v.nextDoseAt && v.nextDoseAt <= v.appliedAt) {
      errors.nextDoseAt = 'A próxima dose deve ser depois da aplicação.';
    }
  }
  if (entity === 'treatment') {
    const t = data as EntityData['treatment'];
    if (t.nextApplicationAt && t.nextApplicationAt <= t.appliedAt) {
      errors.nextApplicationAt = 'A próxima aplicação deve ser depois desta.';
    }
  }

  return Object.keys(errors).length > 0 ? { ok: false, errors } : { ok: true, data };
}

export function entityFields(entity: EntityName): string[] {
  return Object.keys(ENTITY_SCHEMAS[entity].shape);
}

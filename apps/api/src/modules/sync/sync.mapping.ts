import { entityFields, type EntityName, type EntityRecord } from '@agrovax/shared';
import type { Prisma } from '@prisma/client';

/**
 * Ponte entre os registros sincronizaveis (definidos em @agrovax/shared) e as
 * tabelas do Prisma. E o unico lugar que sabe qual tabela guarda cada entidade.
 */

/** Linha de qualquer tabela sincronizavel. */
export interface SyncRow {
  id: string;
  farmId: string;
  version: number;
  syncSeq: bigint;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
  [field: string]: unknown;
}

/** Subconjunto do delegate do Prisma usado pela sincronizacao. */
export interface SyncDelegate {
  findUnique(args: { where: { id: string } }): Promise<SyncRow | null>;
  findMany(args: {
    where: Record<string, unknown>;
    orderBy?: Record<string, 'asc' | 'desc'>;
    take?: number;
  }): Promise<SyncRow[]>;
  count(args: { where: Record<string, unknown> }): Promise<number>;
  create(args: { data: Record<string, unknown> }): Promise<SyncRow>;
  update(args: { where: { id: string }; data: Record<string, unknown> }): Promise<SyncRow>;
}

type Client = Prisma.TransactionClient;

export function delegateFor(client: Client, entity: EntityName): SyncDelegate {
  const delegates: Record<EntityName, unknown> = {
    lot: client.lot,
    animal: client.animal,
    vaccination: client.vaccination,
    treatment: client.preventiveTreatment,
    symptomRecord: client.symptomRecord,
    healthEvent: client.healthEvent,
  };
  return delegates[entity] as SyncDelegate;
}

/** Campos de data sem hora (coluna DATE), trafegados como `AAAA-MM-DD`. */
const DATE_FIELDS: Record<EntityName, readonly string[]> = {
  lot: [],
  animal: ['birthDate'],
  vaccination: ['appliedAt', 'nextDoseAt'],
  treatment: ['appliedAt', 'nextApplicationAt'],
  symptomRecord: ['observedAt'],
  healthEvent: ['occurredAt'],
};

/** Dados do registro (sem campos de controle) no formato trafegado. */
export function rowToData(entity: EntityName, row: SyncRow): Record<string, unknown> {
  const data: Record<string, unknown> = {};
  for (const field of entityFields(entity)) {
    const value = row[field];
    data[field] =
      DATE_FIELDS[entity].includes(field) && value instanceof Date
        ? value.toISOString().slice(0, 10)
        : (value ?? null);
  }
  return data;
}

export function rowToRecord(entity: EntityName, row: SyncRow): EntityRecord {
  return {
    ...rowToData(entity, row),
    id: row.id,
    farmId: row.farmId,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    deletedAt: row.deletedAt?.toISOString() ?? null,
    version: row.version,
  } as EntityRecord;
}

/** Converte os dados validados para o formato de gravacao do Prisma. */
export function dataToColumns(entity: EntityName, data: Record<string, unknown>): Record<string, unknown> {
  const columns: Record<string, unknown> = {};
  for (const field of entityFields(entity)) {
    if (!(field in data)) continue;
    const value = data[field];
    columns[field] =
      DATE_FIELDS[entity].includes(field) && typeof value === 'string'
        ? new Date(`${value}T00:00:00.000Z`)
        : value;
  }
  return columns;
}

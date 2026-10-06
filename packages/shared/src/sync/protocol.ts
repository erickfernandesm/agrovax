import { z } from 'zod';
import type { EntityName, EntityRecord } from './entities';

/** Contrato da sincronizacao entre o aparelho e a API. */

export const SYNC_ACTIONS = ['UPSERT', 'DELETE'] as const;
export type SyncActionName = (typeof SYNC_ACTIONS)[number];

export const SYNC_RESULTS = ['APPLIED', 'CONFLICT', 'REJECTED'] as const;
export type SyncResultName = (typeof SYNC_RESULTS)[number];

export const MAX_PUSH_OPERATIONS = 200;
export const MAX_PULL_LIMIT = 1000;

export const syncOperationSchema = z.object({
  /** Gerado no aparelho; chave de idempotencia. */
  opId: z.uuid(),
  entity: z.enum(['lot', 'animal', 'vaccination', 'treatment', 'symptomRecord', 'healthEvent']),
  recordId: z.uuid(),
  action: z.enum(SYNC_ACTIONS),
  /** Versao do servidor que o aparelho conhecia ao fazer a alteracao (0 = registro novo). */
  baseVersion: z.number().int().min(0),
  /** Somente os campos alterados (ou todos, na criacao). Vazio em DELETE. */
  changes: z.record(z.string(), z.unknown()).default({}),
});
export type SyncOperationInput = z.infer<typeof syncOperationSchema>;

export const syncPushSchema = z.object({
  deviceId: z.string().trim().min(1).max(100),
  operations: z.array(syncOperationSchema).min(1).max(MAX_PUSH_OPERATIONS),
});
export type SyncPushInput = z.infer<typeof syncPushSchema>;

export interface SyncOperationResult {
  opId: string;
  /**
   * APPLIED: aplicada.
   * CONFLICT: aplicada, mas sobrescreveu uma alteracao mais recente de outra origem.
   * REJECTED: nao aplicada (validacao, limite do plano, registro excluido...).
   */
  result: SyncResultName;
  /** Codigo estavel do motivo, quando houver. */
  code?: string;
  /** Mensagem em portugues para o usuario. */
  message?: string;
  /** Estado do registro no servidor apos a operacao. */
  record?: EntityRecord;
}

export interface SyncPushResponse {
  results: SyncOperationResult[];
}

export interface SyncChange {
  entity: EntityName;
  record: EntityRecord;
}

export interface SyncPullResponse {
  changes: SyncChange[];
  /** Enviar na proxima chamada para receber apenas o que mudou depois. */
  cursor: number;
  hasMore: boolean;
}

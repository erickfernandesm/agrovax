import {
  validateEntityData,
  type EntityName,
  type EntityRecord,
  type SyncOperationResult,
  type SyncPullResponse,
  type SyncPushInput,
  type SyncPushResponse,
} from '@agrovax/shared';
import { NetworkError } from '../../services/api/client';
import type { SyncTransport } from '../sync/SyncEngine';

/**
 * Servidor de sincronizacao em memoria para os testes do app. Reproduz o
 * contrato da API real (idempotencia por opId, versoes, sequencia por
 * fazenda, conflitos), cujo comportamento e coberto pelos testes da API.
 */
export class FakeServer implements SyncTransport {
  readonly rows = new Map<string, { entity: EntityName; record: EntityRecord; seq: number }>();
  private readonly processed = new Map<string, SyncOperationResult>();
  private seq = 0;

  /** Simula ausencia de conexao. */
  offline = false;
  /** Aplica o proximo envio, mas "perde" a resposta (queda de sinal). */
  loseNextResponse = false;
  /** Recusa a criacao de animais cujo brinco esteja nesta lista. */
  rejectTags = new Set<string>();
  pushCalls = 0;
  appliedOperations = 0;

  async push(farmId: string, body: SyncPushInput): Promise<SyncPushResponse> {
    if (this.offline) throw new NetworkError();
    this.pushCalls += 1;

    const touched = new Set<string>();
    const results = body.operations.map((op): SyncOperationResult => {
      const replay = this.processed.get(op.opId);
      if (replay) return replay;

      const result = this.apply(farmId, op, touched);
      this.processed.set(op.opId, result);
      if (result.result !== 'REJECTED') {
        touched.add(op.recordId);
        this.appliedOperations += 1;
      }
      return result;
    });

    if (this.loseNextResponse) {
      this.loseNextResponse = false;
      throw new NetworkError();
    }
    return { results };
  }

  private apply(
    farmId: string,
    op: SyncPushInput['operations'][number],
    touched: Set<string>,
  ): SyncOperationResult {
    const existing = this.rows.get(op.recordId);
    const now = new Date().toISOString();

    if (op.action === 'DELETE') {
      if (existing && !existing.record.deletedAt) {
        existing.record = { ...existing.record, deletedAt: now, version: existing.record.version + 1 };
        existing.seq = ++this.seq;
      }
      return { opId: op.opId, result: 'APPLIED', record: existing?.record };
    }

    if (existing?.record.deletedAt) {
      return { opId: op.opId, result: 'REJECTED', code: 'RECORD_DELETED', message: 'Excluído em outro aparelho.' };
    }

    const { id: _id, farmId: _farm, createdAt: _c, updatedAt: _u, deletedAt: _d, version: _v, ...current } =
      (existing?.record ?? {}) as Record<string, unknown>;
    const validation = validateEntityData(op.entity, { ...current, ...op.changes });
    if (!validation.ok || !validation.data) {
      return { opId: op.opId, result: 'REJECTED', code: 'VALIDATION', message: 'Dados inválidos.' };
    }
    const tag = (validation.data as { tag?: string }).tag;
    if (!existing && tag && this.rejectTags.has(tag)) {
      return { opId: op.opId, result: 'REJECTED', code: 'PLAN_LIMIT', message: 'Limite do plano atingido.' };
    }

    const stale = existing !== undefined && op.baseVersion < existing.record.version && !touched.has(op.recordId);
    const record = {
      ...validation.data,
      id: op.recordId,
      farmId,
      createdAt: existing?.record.createdAt ?? now,
      updatedAt: now,
      deletedAt: null,
      version: (existing?.record.version ?? 0) + 1,
    } as EntityRecord;
    this.rows.set(op.recordId, { entity: op.entity, record, seq: ++this.seq });

    return stale
      ? { opId: op.opId, result: 'CONFLICT', code: 'OVERWRITE', message: 'Alterado também em outro aparelho.', record }
      : { opId: op.opId, result: 'APPLIED', record };
  }

  async pull(_farmId: string, cursor: number, limit: number): Promise<SyncPullResponse> {
    if (this.offline) throw new NetworkError();
    const pending = [...this.rows.values()].filter((row) => row.seq > cursor).sort((a, b) => a.seq - b.seq);
    const page = pending.slice(0, limit);
    return {
      changes: page.map(({ entity, record }) => ({ entity, record })),
      cursor: page[page.length - 1]?.seq ?? cursor,
      hasMore: pending.length > limit,
    };
  }

  find<T extends EntityRecord = EntityRecord>(id: string): T | undefined {
    return this.rows.get(id)?.record as T | undefined;
  }

  count(entity: EntityName): number {
    return [...this.rows.values()].filter((row) => row.entity === entity && !row.record.deletedAt).length;
  }
}

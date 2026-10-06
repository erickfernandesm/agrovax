import {
  ENTITY_NAMES,
  entityFields,
  validateEntityData,
  type EntityData,
  type EntityName,
  type EntityRecord,
  type SyncChange,
  type SyncOperationResult,
} from '@agrovax/shared';
import type { StorageAdapter, StoredItem, WriteBatch } from './adapter';

/**
 * Banco local de uma fazenda.
 *
 * - Fonte da verdade do app: as telas leem e gravam aqui, nunca na API.
 * - Toda alteracao grava, na mesma operacao atomica, o registro e uma
 *   entrada na fila de sincronizacao (outbox).
 * - Os ids sao UUIDs gerados no aparelho e nunca mudam apos sincronizar.
 * - Nada e apagado por causa de falha de sincronizacao.
 */

export type OutboxStatus = 'PENDING' | 'FAILED';

export interface OutboxOp {
  opId: string;
  /** Ordem de criacao; as operacoes sao enviadas nesta ordem. */
  seq: number;
  entity: EntityName;
  recordId: string;
  action: 'UPSERT' | 'DELETE';
  baseVersion: number;
  changes: Record<string, unknown>;
  status: OutboxStatus;
  /** Motivo da rejeicao pelo servidor, quando FAILED. */
  error: { code: string; message: string } | null;
  attempts: number;
  createdAt: string;
}

export interface SyncNotice {
  id: string;
  at: string;
  message: string;
}

export class ValidationError extends Error {
  constructor(public readonly fields: Record<string, string>) {
    super(Object.values(fields)[0] ?? 'Dados inválidos.');
    this.name = 'ValidationError';
  }
}

export interface StoreDeps {
  newId: () => string;
  now: () => Date;
}

const OUTBOX = 'outbox';
const META = 'meta';

/** Mutacoes disponiveis dentro de `store.transact`. */
export interface StoreTx {
  create<K extends EntityName>(entity: K, data: EntityData[K]): EntityRecord<K>;
  update<K extends EntityName>(entity: K, id: string, changes: Partial<EntityData[K]>): EntityRecord<K>;
  remove(entity: EntityName, id: string): void;
  setMeta(key: string, value: unknown): void;
}

export class LocalStore {
  private readonly records = new Map<EntityName, Map<string, EntityRecord>>();
  private readonly liveCache = new Map<EntityName, EntityRecord[]>();
  private outbox: OutboxOp[] = [];
  private readonly meta = new Map<string, unknown>();
  /** Operacoes em envio: nao podem ser fundidas com novas alteracoes. */
  private readonly sending = new Set<string>();
  private readonly listeners = new Set<() => void>();
  private nextSeq = 1;
  private revision = 0;
  /** Serializa as gravacoes para que nunca se intercalem. */
  private writeQueue: Promise<void> = Promise.resolve();
  /** Chamado apos cada gravacao feita pelo usuario (nao pelas vindas do servidor). */
  onLocalChange: (() => void) | null = null;

  private constructor(
    readonly farmId: string,
    private readonly adapter: StorageAdapter,
    private readonly deps: StoreDeps,
  ) {
    for (const entity of ENTITY_NAMES) this.records.set(entity, new Map());
  }

  static async open(farmId: string, adapter: StorageAdapter, deps: StoreDeps): Promise<LocalStore> {
    const store = new LocalStore(farmId, adapter, deps);
    await store.load();
    return store;
  }

  private async load(): Promise<void> {
    for (const map of this.records.values()) map.clear();
    this.outbox = [];
    this.meta.clear();
    this.liveCache.clear();

    for (const item of await this.adapter.loadAll(this.farmId)) {
      const value: unknown = JSON.parse(item.json);
      if (item.collection === OUTBOX) this.outbox.push(value as OutboxOp);
      else if (item.collection === META) this.meta.set(item.id, value);
      else this.records.get(item.collection as EntityName)?.set(item.id, value as EntityRecord);
    }
    this.outbox.sort((a, b) => a.seq - b.seq);
    this.nextSeq = (this.outbox[this.outbox.length - 1]?.seq ?? 0) + 1;
  }

  // ---------------------------------------------------------------- leitura

  /** Registros nao excluidos da entidade. A lista e estavel ate a proxima alteracao. */
  all<K extends EntityName>(entity: K): EntityRecord<K>[] {
    let cached = this.liveCache.get(entity);
    if (!cached) {
      cached = [...(this.records.get(entity)?.values() ?? [])].filter((record) => !record.deletedAt);
      this.liveCache.set(entity, cached);
    }
    return cached as unknown as EntityRecord<K>[];
  }

  get<K extends EntityName>(entity: K, id: string): EntityRecord<K> | null {
    const record = this.records.get(entity)?.get(id);
    return record && !record.deletedAt ? (record as unknown as EntityRecord<K>) : null;
  }

  getMeta<T>(key: string, fallback: T): T {
    return this.meta.has(key) ? (this.meta.get(key) as T) : fallback;
  }

  get pendingOps(): OutboxOp[] {
    return this.outbox.filter((op) => op.status === 'PENDING');
  }

  get failedOps(): OutboxOp[] {
    return this.outbox.filter((op) => op.status === 'FAILED');
  }

  get cursor(): number {
    return this.getMeta('cursor', 0);
  }

  get notices(): SyncNotice[] {
    return this.getMeta<SyncNotice[]>('notices', []);
  }

  /** Muda a cada alteracao; usado pela interface para saber quando reler. */
  getRevision = (): number => this.revision;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  // ---------------------------------------------------------------- escrita

  /**
   * Executa um conjunto de alteracoes como uma unidade: ou tudo e gravado
   * (registros + fila), ou nada. Se a gravacao em disco falhar, a memoria
   * volta ao estado anterior e o erro e propagado para a tela.
   */
  async transact<T>(work: (tx: StoreTx) => T): Promise<T> {
    const run = async (): Promise<T> => {
      const batch: WriteBatch = { puts: [], deletes: [] };
      let result: T;
      try {
        result = work(this.createTx(batch));
        await this.adapter.write(this.farmId, batch);
      } catch (error) {
        await this.load();
        this.changed();
        throw error;
      }
      this.changed();
      this.onLocalChange?.();
      return result;
    };
    const next = this.writeQueue.then(run, run);
    this.writeQueue = next.then(
      () => undefined,
      () => undefined,
    );
    return next;
  }

  create<K extends EntityName>(entity: K, data: EntityData[K]): Promise<EntityRecord<K>> {
    return this.transact((tx) => tx.create(entity, data));
  }

  update<K extends EntityName>(
    entity: K,
    id: string,
    changes: Partial<EntityData[K]>,
  ): Promise<EntityRecord<K>> {
    return this.transact((tx) => tx.update(entity, id, changes));
  }

  remove(entity: EntityName, id: string): Promise<void> {
    return this.transact((tx) => tx.remove(entity, id));
  }

  setMeta(key: string, value: unknown): Promise<void> {
    return this.transact((tx) => tx.setMeta(key, value));
  }

  private createTx(batch: WriteBatch): StoreTx {
    const put = (collection: string, id: string, value: unknown) => {
      batch.puts.push({ collection, id, json: JSON.stringify(value) });
    };
    const putRecord = (entity: EntityName, record: EntityRecord) => {
      this.records.get(entity)?.set(record.id, record);
      this.liveCache.delete(entity);
      put(entity, record.id, record);
    };
    const putOp = (op: OutboxOp) => put(OUTBOX, op.opId, op);

    const enqueue = (
      entity: EntityName,
      recordId: string,
      action: OutboxOp['action'],
      baseVersion: number,
      changes: Record<string, unknown>,
    ) => {
      // Alteracoes seguidas no mesmo registro viram uma unica operacao,
      // desde que a anterior ainda nao esteja sendo enviada. Se a anterior foi
      // recusada pelo servidor, a correcao e incorporada a ela e a operacao
      // volta para a fila com novo id (o id antigo ja tem a recusa registrada).
      const last = [...this.outbox].reverse().find((op) => op.recordId === recordId);
      if (last && action === 'UPSERT' && last.action === 'UPSERT' && !this.sending.has(last.opId)) {
        last.changes = { ...last.changes, ...changes };
        if (last.status === 'FAILED') {
          batch.deletes.push({ collection: OUTBOX, id: last.opId });
          last.opId = this.deps.newId();
          last.status = 'PENDING';
          last.error = null;
        }
        putOp(last);
        return;
      }
      const op: OutboxOp = {
        opId: this.deps.newId(),
        seq: this.nextSeq++,
        entity,
        recordId,
        action,
        baseVersion,
        changes,
        status: 'PENDING',
        error: null,
        attempts: 0,
        createdAt: this.deps.now().toISOString(),
      };
      this.outbox.push(op);
      putOp(op);
    };

    const validate = <K extends EntityName>(entity: K, data: unknown): EntityData[K] => {
      const result = validateEntityData(entity, data);
      if (!result.ok || !result.data) throw new ValidationError(result.errors ?? {});
      return result.data;
    };

    return {
      create: (entity, data) => {
        const valid = validate(entity, data);
        const now = this.deps.now().toISOString();
        const record = {
          ...valid,
          id: this.deps.newId(),
          farmId: this.farmId,
          createdAt: now,
          updatedAt: now,
          deletedAt: null,
          version: 0,
        } as EntityRecord<typeof entity>;
        putRecord(entity, record);
        enqueue(entity, record.id, 'UPSERT', 0, valid as Record<string, unknown>);
        return record;
      },

      update: (entity, id, changes) => {
        const current = this.get(entity, id);
        if (!current) throw new Error('Registro não encontrado.');

        const data: Record<string, unknown> = {};
        for (const field of entityFields(entity)) data[field] = (current as unknown as Record<string, unknown>)[field];
        const valid = validate(entity, { ...data, ...changes }) as Record<string, unknown>;

        const changed: Record<string, unknown> = {};
        for (const field of Object.keys(changes)) {
          if (JSON.stringify(valid[field]) !== JSON.stringify(data[field])) changed[field] = valid[field];
        }
        if (Object.keys(changed).length === 0) return current;

        const record = {
          ...current,
          ...changed,
          updatedAt: this.deps.now().toISOString(),
        } as EntityRecord<typeof entity>;
        putRecord(entity, record);
        enqueue(entity, id, 'UPSERT', current.version, changed);
        return record;
      },

      remove: (entity, id) => {
        const current = this.get(entity, id);
        if (!current) return;

        const ownOps = this.outbox.filter((op) => op.recordId === id);
        const neverSent = current.version === 0 && ownOps.every((op) => !this.sending.has(op.opId));
        if (neverSent) {
          // O servidor nunca soube deste registro: basta esquece-lo.
          this.outbox = this.outbox.filter((op) => op.recordId !== id);
          for (const op of ownOps) batch.deletes.push({ collection: OUTBOX, id: op.opId });
          this.records.get(entity)?.delete(id);
          this.liveCache.delete(entity);
          batch.deletes.push({ collection: entity, id });
          return;
        }
        putRecord(entity, { ...current, deletedAt: this.deps.now().toISOString() });
        enqueue(entity, id, 'DELETE', current.version, {});
      },

      setMeta: (key, value) => {
        this.meta.set(key, value);
        put(META, key, value);
      },
    };
  }

  // ----------------------------------------------------------- sincronizacao

  /** Proximo lote a enviar. As operacoes ficam marcadas como "em envio". */
  takeBatch(size: number): OutboxOp[] {
    const batch = this.pendingOps.slice(0, size);
    for (const op of batch) this.sending.add(op.opId);
    return batch;
  }

  /** O envio terminou (com ou sem resposta): libera as operacoes. */
  releaseBatch(batch: readonly OutboxOp[]): void {
    for (const op of batch) this.sending.delete(op.opId);
  }

  /** Registra o resultado devolvido pelo servidor para cada operacao enviada. */
  async applyPushResults(results: readonly SyncOperationResult[]): Promise<void> {
    await this.transactRaw((batch) => {
      const notices = [...this.notices];
      for (const result of results) {
        const op = this.outbox.find((item) => item.opId === result.opId);
        if (!op) continue;

        if (result.result === 'REJECTED') {
          if (result.code === 'INTERNAL') {
            // Falha temporaria do servidor: continua na fila.
            op.attempts += 1;
          } else {
            op.status = 'FAILED';
            op.error = {
              code: result.code ?? 'REJECTED',
              message: result.message ?? 'O servidor recusou esta alteração.',
            };
          }
          batch.puts.push({ collection: OUTBOX, id: op.opId, json: JSON.stringify(op) });
          continue;
        }

        this.outbox = this.outbox.filter((item) => item.opId !== op.opId);
        batch.deletes.push({ collection: OUTBOX, id: op.opId });

        if (result.result === 'CONFLICT' && result.message) {
          notices.unshift({ id: op.opId, at: this.deps.now().toISOString(), message: result.message });
        }
        if (result.record) this.mergeServerRecord(op.entity, result.record, batch, true);
      }
      this.putMeta(batch, 'notices', notices.slice(0, 20));
      this.putMeta(batch, 'lastSyncAt', this.deps.now().toISOString());
    });
  }

  /** Aplica o que veio do servidor e avanca o cursor. */
  async applyServerChanges(changes: readonly SyncChange[], cursor: number): Promise<void> {
    await this.transactRaw((batch) => {
      for (const change of changes) this.mergeServerRecord(change.entity, change.record, batch, false);
      this.putMeta(batch, 'cursor', cursor);
      this.putMeta(batch, 'lastSyncAt', this.deps.now().toISOString());
    });
  }

  /**
   * Grava o estado do servidor sem perder alteracoes locais ainda nao
   * enviadas: os campos com alteracao pendente continuam com o valor local.
   */
  private mergeServerRecord(
    entity: EntityName,
    server: EntityRecord,
    batch: WriteBatch,
    fromOwnPush: boolean,
  ): void {
    const pending = this.outbox.filter((op) => op.recordId === server.id);
    const map = this.records.get(entity);
    if (!map) return;

    if (fromOwnPush) {
      // As proximas operacoes deste registro partem da versao recem-confirmada.
      for (const op of pending) {
        op.baseVersion = server.version;
        batch.puts.push({ collection: OUTBOX, id: op.opId, json: JSON.stringify(op) });
      }
    }

    if (pending.length === 0 && server.deletedAt) {
      map.delete(server.id);
      batch.deletes.push({ collection: entity, id: server.id });
      this.liveCache.delete(entity);
      return;
    }

    let merged: EntityRecord = server;
    const local = map.get(server.id);
    for (const op of pending) {
      merged =
        op.action === 'DELETE'
          ? { ...merged, deletedAt: local?.deletedAt ?? this.deps.now().toISOString() }
          : ({ ...merged, ...op.changes } as EntityRecord);
    }
    map.set(server.id, merged);
    this.liveCache.delete(entity);
    batch.puts.push({ collection: entity, id: server.id, json: JSON.stringify(merged) });
  }

  /** Recoloca na fila uma operacao recusada (o usuario pediu nova tentativa). */
  async retryFailed(opId?: string): Promise<void> {
    await this.transactRaw((batch) => {
      for (const op of this.outbox) {
        if (op.status !== 'FAILED' || (opId && op.opId !== opId)) continue;
        // Novo id: o servidor guardou a recusa do id anterior e a repetiria.
        batch.deletes.push({ collection: OUTBOX, id: op.opId });
        op.opId = this.deps.newId();
        op.status = 'PENDING';
        op.error = null;
        batch.puts.push({ collection: OUTBOX, id: op.opId, json: JSON.stringify(op) });
      }
    });
  }

  /**
   * Desiste de uma operacao recusada. O registro local volta a refletir o
   * servidor: se nunca foi aceito, e removido; senao, sera baixado de novo.
   */
  async discardFailed(opId: string): Promise<void> {
    await this.transactRaw((batch) => {
      const op = this.outbox.find((item) => item.opId === opId && item.status === 'FAILED');
      if (!op) return;
      const related = this.outbox.filter((item) => item.recordId === op.recordId);
      this.outbox = this.outbox.filter((item) => item.recordId !== op.recordId);
      for (const item of related) batch.deletes.push({ collection: OUTBOX, id: item.opId });

      const record = this.records.get(op.entity)?.get(op.recordId);
      if (record && record.version === 0) {
        this.records.get(op.entity)?.delete(op.recordId);
        batch.deletes.push({ collection: op.entity, id: op.recordId });
        this.liveCache.delete(op.entity);
      } else {
        this.putMeta(batch, 'cursor', 0);
      }
    });
  }

  async clearNotices(): Promise<void> {
    await this.transactRaw((batch) => this.putMeta(batch, 'notices', []));
  }

  private putMeta(batch: WriteBatch, key: string, value: unknown): void {
    this.meta.set(key, value);
    batch.puts.push({ collection: META, id: key, json: JSON.stringify(value) });
  }

  private transactRaw(work: (batch: WriteBatch) => void): Promise<void> {
    const run = async (): Promise<void> => {
      const batch: WriteBatch = { puts: [], deletes: [] };
      try {
        work(batch);
        await this.adapter.write(this.farmId, batch);
      } catch (error) {
        await this.load();
        this.changed();
        throw error;
      }
      this.changed();
    };
    const next = this.writeQueue.then(run, run);
    this.writeQueue = next.then(
      () => undefined,
      () => undefined,
    );
    return next;
  }

  private changed(): void {
    this.revision += 1;
    for (const listener of this.listeners) listener();
  }
}

export type { StoredItem };

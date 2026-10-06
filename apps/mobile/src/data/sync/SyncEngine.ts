import type {
  SyncPullResponse,
  SyncPushInput,
  SyncPushResponse,
  SyncState,
} from '@agrovax/shared';
import { NetworkError } from '../../services/api/client';
import type { LocalStore } from '../store/LocalStore';

/**
 * Motor de sincronizacao.
 *
 * Ciclo: envia a fila de operacoes em lotes (push) e depois baixa o que
 * mudou no servidor desde o ultimo cursor (pull).
 *
 * Garantias:
 * - uma execucao por vez;
 * - cada operacao tem um id proprio, entao reenviar apos uma resposta perdida
 *   nao duplica nada;
 * - falha de rede nao altera nem apaga dados locais: a fila continua intacta
 *   e ha nova tentativa com intervalo crescente;
 * - operacoes recusadas pelo servidor ficam marcadas, com o motivo, para o
 *   usuario decidir.
 */

export interface SyncTransport {
  push(farmId: string, body: SyncPushInput): Promise<SyncPushResponse>;
  pull(farmId: string, cursor: number, limit: number): Promise<SyncPullResponse>;
}

export interface SyncStatus {
  state: SyncState;
  pending: number;
  failed: number;
  lastSyncAt: string | null;
  /** Mensagem do ultimo erro, quando o estado e ERROR. */
  message: string | null;
}

export interface SyncEngineOptions {
  deviceId: string;
  isOnline: () => boolean;
  pushBatchSize?: number;
  pullPageSize?: number;
  /** Agendador de novas tentativas; substituivel nos testes. */
  schedule?: (callback: () => void, delayMs: number) => () => void;
}

const RETRY_DELAYS_MS = [5_000, 15_000, 60_000, 5 * 60_000];

const defaultSchedule = (callback: () => void, delayMs: number) => {
  const timer = setTimeout(callback, delayMs);
  return () => clearTimeout(timer);
};

export class SyncEngine {
  private running: Promise<void> | null = null;
  private rerun = false;
  private failures = 0;
  private syncing = false;
  private errorMessage: string | null = null;
  private cancelRetry: (() => void) | null = null;
  private cancelDebounce: (() => void) | null = null;
  private stopped = false;
  private readonly listeners = new Set<() => void>();
  private cachedStatus: SyncStatus | null = null;
  private readonly unsubscribeStore: () => void;

  private readonly pushBatchSize: number;
  private readonly pullPageSize: number;
  private readonly schedule: NonNullable<SyncEngineOptions['schedule']>;

  constructor(
    private readonly store: LocalStore,
    private readonly transport: SyncTransport,
    private readonly options: SyncEngineOptions,
  ) {
    this.pushBatchSize = options.pushBatchSize ?? 100;
    this.pullPageSize = options.pullPageSize ?? 500;
    this.schedule = options.schedule ?? defaultSchedule;
    this.unsubscribeStore = store.subscribe(() => this.notify());
  }

  // ---------------------------------------------------------------- estado

  getStatus = (): SyncStatus => {
    if (!this.cachedStatus) {
      const pending = this.store.pendingOps.length;
      const failed = this.store.failedOps.length;
      let state: SyncState;
      if (this.syncing) state = 'SYNCING';
      else if (!this.options.isOnline()) state = 'OFFLINE';
      else if (this.errorMessage || failed > 0) state = 'ERROR';
      else state = 'SYNCED';

      this.cachedStatus = {
        state,
        pending,
        failed,
        lastSyncAt: this.store.getMeta<string | null>('lastSyncAt', null),
        message:
          this.errorMessage ??
          (failed > 0 ? `${failed} ${failed === 1 ? 'alteração foi recusada' : 'alterações foram recusadas'} pelo servidor.` : null),
      };
    }
    return this.cachedStatus;
  };

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  /** A conectividade mudou: reavalia o estado e sincroniza se voltou a conexao. */
  connectivityChanged(): void {
    this.notify();
    if (this.options.isOnline()) void this.sync();
  }

  private notify(): void {
    this.cachedStatus = null;
    for (const listener of this.listeners) listener();
  }

  // ------------------------------------------------------------- execucao

  /** Pede uma sincronizacao em breve (agrupa varias gravacoes seguidas). */
  requestSync(delayMs = 1_500): void {
    if (this.stopped) return;
    this.cancelDebounce?.();
    this.cancelDebounce = this.schedule(() => {
      this.cancelDebounce = null;
      void this.sync();
    }, delayMs);
  }

  /** Sincroniza agora. Chamadas simultaneas compartilham a mesma execucao. */
  sync(): Promise<void> {
    if (this.stopped) return Promise.resolve();
    if (this.running) {
      this.rerun = true;
      return this.running;
    }
    // Um pedido feito durante a execucao gera mais uma rodada ao final, e a
    // promessa so se resolve quando nao ha mais rodadas pendentes.
    const loop = async (): Promise<void> => {
      do {
        this.rerun = false;
        await this.run();
      } while (this.rerun && !this.stopped);
    };
    this.running = loop().finally(() => {
      this.running = null;
    });
    return this.running;
  }

  stop(): void {
    this.stopped = true;
    this.cancelRetry?.();
    this.cancelDebounce?.();
    this.unsubscribeStore();
    this.listeners.clear();
  }

  private async run(): Promise<void> {
    this.cancelRetry?.();
    this.cancelRetry = null;
    if (!this.options.isOnline()) {
      this.notify();
      return;
    }

    this.syncing = true;
    this.notify();
    try {
      await this.pushAll();
      await this.pullAll();
      this.errorMessage = null;
      this.failures = 0;
    } catch (error) {
      if (error instanceof NetworkError) {
        // Sem conexao de fato: nao e erro do usuario, apenas aguarda.
        this.errorMessage = this.options.isOnline()
          ? 'Não foi possível falar com o servidor. Tentaremos de novo automaticamente.'
          : null;
      } else {
        this.errorMessage =
          error instanceof Error ? error.message : 'Falha inesperada na sincronização.';
      }
      this.scheduleRetry();
    } finally {
      this.syncing = false;
      this.notify();
    }
  }

  private async pushAll(): Promise<void> {
    // Limite de seguranca contra laco infinito caso o servidor nunca confirme.
    for (let round = 0; round < 1_000; round += 1) {
      const batch = this.store.takeBatch(this.pushBatchSize);
      if (batch.length === 0) return;
      try {
        const response = await this.transport.push(this.store.farmId, {
          deviceId: this.options.deviceId,
          operations: batch.map((op) => ({
            opId: op.opId,
            entity: op.entity,
            recordId: op.recordId,
            action: op.action,
            baseVersion: op.baseVersion,
            changes: op.changes,
          })),
        });
        await this.store.applyPushResults(response.results);

        // Erro temporario do servidor em alguma operacao: para e tenta depois,
        // preservando a ordem da fila.
        if (response.results.some((result) => result.code === 'INTERNAL')) {
          throw new Error('O servidor não conseguiu processar algumas alterações. Tentaremos de novo.');
        }
      } finally {
        this.store.releaseBatch(batch);
      }
    }
  }

  private async pullAll(): Promise<void> {
    for (let page = 0; page < 10_000; page += 1) {
      const response = await this.transport.pull(this.store.farmId, this.store.cursor, this.pullPageSize);
      await this.store.applyServerChanges(response.changes, response.cursor);
      if (!response.hasMore) return;
    }
  }

  private scheduleRetry(): void {
    const delay = RETRY_DELAYS_MS[Math.min(this.failures, RETRY_DELAYS_MS.length - 1)] ?? 60_000;
    this.failures += 1;
    this.cancelRetry = this.schedule(() => {
      this.cancelRetry = null;
      void this.sync();
    }, delay);
  }
}

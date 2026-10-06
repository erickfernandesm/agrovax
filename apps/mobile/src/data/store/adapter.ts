/**
 * Persistencia do banco local.
 *
 * O LocalStore mantem os registros da fazenda em memoria (consultas
 * instantaneas, sem depender de rede) e usa este adaptador para grava-los de
 * forma duravel. Ha tres implementacoes: SQLite no aparelho, armazenamento
 * do navegador na pre-visualizacao web e memoria nos testes.
 */

export interface StoredItem {
  collection: string;
  id: string;
  json: string;
}

export interface WriteBatch {
  puts: StoredItem[];
  deletes: { collection: string; id: string }[];
}

export interface StorageAdapter {
  /** Todos os itens de um escopo (uma fazenda, ou "global"). */
  loadAll(scope: string): Promise<StoredItem[]>;
  /** Grava o lote inteiro ou nada (atomico). */
  write(scope: string, batch: WriteBatch): Promise<void>;
  /** Valores grandes lidos sob demanda (fotos), fora da memoria do store. */
  getBlob(key: string): Promise<string | null>;
  setBlob(key: string, value: string | null): Promise<void>;
}

/** Adaptador em memoria, usado nos testes e como base de comportamento. */
export class MemoryAdapter implements StorageAdapter {
  private readonly scopes = new Map<string, Map<string, StoredItem>>();
  private readonly blobs = new Map<string, string>();
  /** Quando definido, a proxima gravacao falha (simula disco cheio). */
  failNextWrite = false;

  private scope(scope: string): Map<string, StoredItem> {
    let items = this.scopes.get(scope);
    if (!items) {
      items = new Map();
      this.scopes.set(scope, items);
    }
    return items;
  }

  async loadAll(scope: string): Promise<StoredItem[]> {
    return [...this.scope(scope).values()].map((item) => ({ ...item }));
  }

  async write(scope: string, batch: WriteBatch): Promise<void> {
    if (this.failNextWrite) {
      this.failNextWrite = false;
      throw new Error('falha simulada de gravacao');
    }
    const items = this.scope(scope);
    for (const item of batch.puts) items.set(`${item.collection}/${item.id}`, { ...item });
    for (const item of batch.deletes) items.delete(`${item.collection}/${item.id}`);
  }

  async getBlob(key: string): Promise<string | null> {
    return this.blobs.get(key) ?? null;
  }

  async setBlob(key: string, value: string | null): Promise<void> {
    if (value === null) this.blobs.delete(key);
    else this.blobs.set(key, value);
  }
}

import type { StorageAdapter, StoredItem, WriteBatch } from './adapter';

/**
 * Persistencia da pre-visualizacao WEB (desenvolvimento), em localStorage.
 * O produto e o aplicativo Android/iOS, que usa SQLite (platformAdapter.ts).
 * O navegador limita o espaco a alguns megabytes: serve para testar, nao
 * para um rebanho real.
 */
const PREFIX = 'agrovax-db';
const itemKey = (scope: string, collection: string, id: string) =>
  `${PREFIX}/${scope}/${collection}/${id}`;

class WebAdapter implements StorageAdapter {
  async loadAll(scope: string): Promise<StoredItem[]> {
    const prefix = `${PREFIX}/${scope}/`;
    const items: StoredItem[] = [];
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i);
      if (!key?.startsWith(prefix)) continue;
      const rest = key.slice(prefix.length);
      const slash = rest.indexOf('/');
      const json = localStorage.getItem(key);
      if (slash > 0 && json !== null) {
        items.push({ collection: rest.slice(0, slash), id: rest.slice(slash + 1), json });
      }
    }
    return items;
  }

  async write(scope: string, batch: WriteBatch): Promise<void> {
    // localStorage nao tem transacao: em caso de falha (espaco esgotado),
    // desfaz o que ja foi escrito neste lote.
    const previous = new Map<string, string | null>();
    try {
      for (const item of batch.puts) {
        const key = itemKey(scope, item.collection, item.id);
        if (!previous.has(key)) previous.set(key, localStorage.getItem(key));
        localStorage.setItem(key, item.json);
      }
      for (const item of batch.deletes) {
        const key = itemKey(scope, item.collection, item.id);
        if (!previous.has(key)) previous.set(key, localStorage.getItem(key));
        localStorage.removeItem(key);
      }
    } catch (error) {
      for (const [key, value] of previous) {
        if (value === null) localStorage.removeItem(key);
        else localStorage.setItem(key, value);
      }
      throw error;
    }
  }

  async getBlob(key: string): Promise<string | null> {
    return localStorage.getItem(`${PREFIX}-blob/${key}`);
  }

  async setBlob(key: string, value: string | null): Promise<void> {
    if (value === null) localStorage.removeItem(`${PREFIX}-blob/${key}`);
    else localStorage.setItem(`${PREFIX}-blob/${key}`, value);
  }
}

export const platformAdapter: StorageAdapter = new WebAdapter();

import * as SQLite from 'expo-sqlite';
import type { StorageAdapter, StoredItem, WriteBatch } from './adapter';

/**
 * Persistencia no aparelho (Android/iOS) usando SQLite.
 * Cada gravacao do LocalStore vira uma transacao: registro e fila de
 * sincronizacao sao gravados juntos ou nao sao gravados.
 */
class SqliteAdapter implements StorageAdapter {
  private database: Promise<SQLite.SQLiteDatabase> | null = null;
  /** O SQLite aceita uma transacao por vez nesta conexao. */
  private queue: Promise<unknown> = Promise.resolve();

  private open(): Promise<SQLite.SQLiteDatabase> {
    if (!this.database) {
      this.database = (async () => {
        const db = await SQLite.openDatabaseAsync('agrovax.db');
        await db.execAsync(`
          PRAGMA journal_mode = WAL;
          CREATE TABLE IF NOT EXISTS items (
            scope TEXT NOT NULL,
            collection TEXT NOT NULL,
            id TEXT NOT NULL,
            json TEXT NOT NULL,
            PRIMARY KEY (scope, collection, id)
          );
          CREATE TABLE IF NOT EXISTS blobs (
            key TEXT PRIMARY KEY NOT NULL,
            value TEXT NOT NULL
          );
        `);
        return db;
      })();
    }
    return this.database;
  }

  private enqueue<T>(work: (db: SQLite.SQLiteDatabase) => Promise<T>): Promise<T> {
    const run = async () => work(await this.open());
    const next = this.queue.then(run, run);
    this.queue = next.catch(() => undefined);
    return next;
  }

  loadAll(scope: string): Promise<StoredItem[]> {
    return this.enqueue((db) =>
      db.getAllAsync<StoredItem>('SELECT collection, id, json FROM items WHERE scope = ?', [scope]),
    );
  }

  write(scope: string, batch: WriteBatch): Promise<void> {
    if (batch.puts.length === 0 && batch.deletes.length === 0) return Promise.resolve();
    return this.enqueue((db) =>
      db.withTransactionAsync(async () => {
        for (const item of batch.puts) {
          await db.runAsync(
            'INSERT OR REPLACE INTO items (scope, collection, id, json) VALUES (?, ?, ?, ?)',
            [scope, item.collection, item.id, item.json],
          );
        }
        for (const item of batch.deletes) {
          await db.runAsync('DELETE FROM items WHERE scope = ? AND collection = ? AND id = ?', [
            scope,
            item.collection,
            item.id,
          ]);
        }
      }),
    );
  }

  getBlob(key: string): Promise<string | null> {
    return this.enqueue(async (db) => {
      const row = await db.getFirstAsync<{ value: string }>('SELECT value FROM blobs WHERE key = ?', [key]);
      return row?.value ?? null;
    });
  }

  setBlob(key: string, value: string | null): Promise<void> {
    return this.enqueue(async (db) => {
      if (value === null) await db.runAsync('DELETE FROM blobs WHERE key = ?', [key]);
      else await db.runAsync('INSERT OR REPLACE INTO blobs (key, value) VALUES (?, ?)', [key, value]);
    });
  }
}

export const platformAdapter: StorageAdapter = new SqliteAdapter();

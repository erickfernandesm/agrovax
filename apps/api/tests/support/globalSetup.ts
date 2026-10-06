import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { startEmbeddedDb, type EmbeddedDb } from '../../scripts/embedded-pg';

/**
 * Sobe um PostgreSQL descartavel, aplica as migrations reais e o derruba no
 * fim. Os testes exercitam a API contra um banco de verdade, sem mocks.
 *
 * Para usar um banco proprio (CI, por exemplo), defina TEST_DATABASE_URL.
 */
const apiRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

let db: EmbeddedDb | undefined;

export async function setup(): Promise<void> {
  let url = process.env.TEST_DATABASE_URL;
  if (!url) {
    db = await startEmbeddedDb({
      dataDir: '.pgdata-test',
      port: Number(process.env.TEST_DB_PORT ?? 5434),
      database: 'agrovax_test',
      persistent: false,
    });
    url = db.url;
  }
  process.env.DATABASE_URL = url;

  const prismaCli = path.resolve(apiRoot, '..', '..', 'node_modules', 'prisma', 'build', 'index.js');
  execFileSync(process.execPath, [prismaCli, 'migrate', 'deploy'], {
    cwd: apiRoot,
    env: { ...process.env, DATABASE_URL: url },
    stdio: 'pipe',
  });
}

export async function teardown(): Promise<void> {
  await db?.stop();
}

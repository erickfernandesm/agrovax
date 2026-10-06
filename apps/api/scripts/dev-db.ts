import 'dotenv/config';
import { startEmbeddedDb, stopEmbeddedDb } from './embedded-pg';

/**
 * Controla o PostgreSQL embarcado de desenvolvimento (dados em apps/api/.pgdata).
 *
 *   npm run db:dev    -> inicia o servidor em segundo plano
 *   npm run db:stop   -> encerra o servidor
 */
const DATA_DIR = '.pgdata';
const port = Number(process.env.DEV_DB_PORT ?? 5433);

if (process.argv[2] === 'stop') {
  const stopped = await stopEmbeddedDb(DATA_DIR);
  console.log(stopped ? 'PostgreSQL de desenvolvimento encerrado.' : 'O banco nao estava em execucao.');
} else {
  const db = await startEmbeddedDb({
    dataDir: DATA_DIR,
    port,
    database: 'agrovax',
    persistent: true,
  });
  console.log('PostgreSQL de desenvolvimento em execucao (segundo plano).');
  console.log(`DATABASE_URL="${db.url}"`);
  console.log('Para encerrar: npm run db:stop');
}

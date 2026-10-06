import { execFile } from 'node:child_process';
import { existsSync, mkdirSync, rmSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

/**
 * PostgreSQL embarcado para desenvolvimento e testes.
 *
 * Evita exigir Docker ou uma instalacao do PostgreSQL na maquina: os binarios
 * vem dos pacotes `@embedded-postgres/*` (instalados pelo pacote npm
 * `embedded-postgres`). O servidor e controlado pelo `pg_ctl`, que funciona
 * inclusive em contas de administrador do Windows, onde o `postgres.exe`
 * se recusa a iniciar diretamente.
 *
 * Em producao usa-se um PostgreSQL gerenciado, apontado por DATABASE_URL.
 */

const run = promisify(execFile);
const apiRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const USER = 'agrovax';

export interface EmbeddedDbOptions {
  /** Pasta de dados, relativa a apps/api. */
  dataDir: string;
  port: number;
  database: string;
  /** Se false, a pasta de dados e recriada a cada inicio e apagada ao parar. */
  persistent: boolean;
}

export interface EmbeddedDb {
  url: string;
  stop: () => Promise<void>;
}

interface PgBinaries {
  pg_ctl: string;
  initdb: string;
}

async function loadBinaries(): Promise<PgBinaries> {
  const os = process.platform === 'win32' ? 'windows' : process.platform;
  const packageName = `@embedded-postgres/${os}-${process.arch}`;
  try {
    return (await import(packageName)) as PgBinaries;
  } catch {
    throw new Error(
      `Binarios do PostgreSQL embarcado indisponiveis para esta plataforma (${packageName}). ` +
        'Use um PostgreSQL proprio e defina DATABASE_URL.',
    );
  }
}

async function isRunning(pgCtl: string, dir: string): Promise<boolean> {
  try {
    await run(pgCtl, ['status', '-D', dir]);
    return true;
  } catch {
    return false;
  }
}

/** Encerra o servidor da pasta informada. Retorna false se ele nao estava rodando. */
export async function stopEmbeddedDb(dataDir: string): Promise<boolean> {
  const { pg_ctl: pgCtl } = await loadBinaries();
  const dir = path.join(apiRoot, dataDir);
  if (!(await isRunning(pgCtl, dir))) return false;
  await run(pgCtl, ['stop', '-D', dir, '-m', 'fast', '-w']);
  return true;
}

export async function startEmbeddedDb(options: EmbeddedDbOptions): Promise<EmbeddedDb> {
  const { pg_ctl: pgCtl, initdb } = await loadBinaries();
  const dir = path.join(apiRoot, options.dataDir);
  const logFile = path.join(dir, 'server.log');

  if (await isRunning(pgCtl, dir)) {
    await run(pgCtl, ['stop', '-D', dir, '-m', 'fast', '-w']);
  }
  if (!options.persistent) rmSync(dir, { recursive: true, force: true });

  if (!existsSync(path.join(dir, 'PG_VERSION'))) {
    mkdirSync(dir, { recursive: true });
    // Autenticacao "trust": o servidor so aceita conexoes locais (localhost).
    await run(initdb, ['-D', dir, '-U', USER, '--auth=trust', '--encoding=UTF8', '--locale=C']);
  }

  // `pg_ctl start` nao pode herdar stdout/stderr por pipe: o servidor manteria
  // os descritores abertos e a chamada nunca retornaria. Por isso o log vai
  // para arquivo (-l) e a saida do processo e ignorada.
  await new Promise<void>((resolve, reject) => {
    const child = execFile(
      pgCtl,
      ['start', '-D', dir, '-w', '-l', logFile, '-o', `-p ${options.port} -c listen_addresses=localhost`],
      { windowsHide: true },
    );
    child.stdout?.destroy();
    child.stderr?.destroy();
    child.on('error', reject);
    child.on('exit', (code) =>
      code === 0
        ? resolve()
        : reject(new Error(`Falha ao iniciar o PostgreSQL embarcado (veja ${logFile}).`)),
    );
  });

  return {
    url: `postgresql://${USER}@localhost:${options.port}/${options.database}?schema=public`,
    stop: async () => {
      await run(pgCtl, ['stop', '-D', dir, '-m', 'fast', '-w']);
      if (!options.persistent) rmSync(dir, { recursive: true, force: true });
    },
  };
}

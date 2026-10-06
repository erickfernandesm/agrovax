import { createApp } from './app';
import { env } from './config/env';
import { logger } from './lib/logger';
import { prisma } from './lib/prisma';
import { ensureDefaultPlans } from './modules/plans/plan.service';
import { createMailer } from './services/mailer';

await ensureDefaultPlans(prisma);

const app = createApp({ db: prisma, mailer: createMailer() });
const server = app.listen(env.PORT, () => {
  logger.info(`AgroVax API ouvindo na porta ${env.PORT} (${env.NODE_ENV})`);
});

function shutdown(signal: string): void {
  logger.info(`${signal} recebido, encerrando...`);
  server.close(() => {
    void prisma.$disconnect().finally(() => process.exit(0));
  });
}
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

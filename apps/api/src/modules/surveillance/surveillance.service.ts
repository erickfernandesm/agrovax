import type { PrismaClient } from '@prisma/client';
import { logger } from '../../lib/logger';
import type { ExternalAlert, SurveillanceProvider } from './surveillance.providers';

export interface ImportSummary {
  provider: string;
  imported: number;
  error?: string;
}

function toColumns(alert: ExternalAlert) {
  return {
    diseaseId: alert.diseaseId ?? null,
    diseaseName: alert.diseaseName,
    state: alert.state ?? null,
    region: alert.region,
    reportedAt: new Date(`${alert.reportedAt}T00:00:00.000Z`),
    riskLevel: alert.riskLevel,
    description: alert.description,
    guidance: alert.guidance,
    sourceName: alert.sourceName,
    sourceUrl: alert.sourceUrl ?? null,
    isDemo: false,
    active: alert.active,
  };
}

/** Importa alertas das fontes externas configuradas. */
export class SurveillanceService {
  constructor(
    private readonly db: PrismaClient,
    private readonly providers: SurveillanceProvider[],
  ) {}

  get hasProviders(): boolean {
    return this.providers.length > 0;
  }

  async importAll(): Promise<ImportSummary[]> {
    const summaries: ImportSummary[] = [];
    for (const provider of this.providers) {
      try {
        const alerts = await provider.fetchAlerts();
        for (const alert of alerts) {
          const columns = toColumns(alert);
          await this.db.surveillanceAlert.upsert({
            where: {
              providerKey_externalId: { providerKey: provider.key, externalId: alert.externalId },
            },
            update: columns,
            create: { ...columns, providerKey: provider.key, externalId: alert.externalId },
          });
        }
        summaries.push({ provider: provider.key, imported: alerts.length });
      } catch (error) {
        logger.error({ err: error, provider: provider.key }, 'falha ao importar vigilancia');
        summaries.push({
          provider: provider.key,
          imported: 0,
          error: error instanceof Error ? error.message : 'erro desconhecido',
        });
      }
    }
    return summaries;
  }
}

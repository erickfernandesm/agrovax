import { surveillanceInputSchema, type SurveillanceInput } from '@agrovax/shared';
import { z } from 'zod';
import { env } from '../../config/env';

/**
 * Fontes externas de alertas de vigilancia sanitaria.
 *
 * Para integrar uma fonte oficial, implemente `SurveillanceProvider` e
 * registre-a em `configuredProviders`. Cada alerta importado guarda a chave
 * do provedor e o id na origem, o que evita duplicar ao reimportar.
 *
 * Nenhuma fonte vem configurada por padrao: o sistema nao inventa surtos.
 */

export interface ExternalAlert extends SurveillanceInput {
  /** Identificador estavel do alerta na fonte. */
  externalId: string;
}

export interface SurveillanceProvider {
  /** Chave estavel do provedor (gravada em SurveillanceAlert.providerKey). */
  readonly key: string;
  fetchAlerts(): Promise<ExternalAlert[]>;
}

const feedItemSchema = surveillanceInputSchema.extend({
  externalId: z.string().trim().min(1).max(200),
});

/**
 * Provedor generico: le um endereco que devolve um array JSON no formato
 * `ExternalAlert`. Serve para um servico intermediario mantido pelo AgroVax
 * que converta os dados de um orgao oficial para este formato.
 */
export class JsonFeedProvider implements SurveillanceProvider {
  readonly key = 'json-feed';

  constructor(
    private readonly url: string,
    private readonly fetchFn: typeof fetch = fetch,
  ) {}

  async fetchAlerts(): Promise<ExternalAlert[]> {
    const response = await this.fetchFn(this.url, { signal: AbortSignal.timeout(20_000) });
    if (!response.ok) throw new Error(`A fonte respondeu ${response.status}.`);
    const items = z.array(z.unknown()).parse(await response.json());

    const alerts: ExternalAlert[] = [];
    for (const item of items) {
      const parsed = feedItemSchema.safeParse(item);
      // Itens fora do formato sao descartados; dados de fonte externa nunca
      // sao marcados como DEMO nem publicados sem fonte identificada.
      if (parsed.success) alerts.push({ ...parsed.data, isDemo: false });
    }
    return alerts;
  }
}

export function configuredProviders(): SurveillanceProvider[] {
  return env.SURVEILLANCE_FEED_URL ? [new JsonFeedProvider(env.SURVEILLANCE_FEED_URL)] : [];
}

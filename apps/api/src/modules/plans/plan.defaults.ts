import type { PlanCode, PlanLimits } from '@agrovax/shared';

export interface PlanDefinition {
  code: PlanCode;
  name: string;
  limits: PlanLimits;
  features: Record<string, boolean>;
  priceCents: number;
}

/**
 * Planos padrao. Os limites e precos sao PROVISORIOS (decisao comercial em
 * aberto) e podem ser alterados direto na tabela Plan, sem novo deploy.
 */
export const DEFAULT_PLANS: readonly PlanDefinition[] = [
  {
    code: 'FREE',
    name: 'Gratuito',
    limits: { maxAnimals: 30, maxLots: 2, maxUsers: 1 },
    features: { surveillance: true, diseaseLibrary: true, reports: false },
    priceCents: 0,
  },
  {
    code: 'PRO',
    name: 'Pro',
    limits: { maxAnimals: null, maxLots: null, maxUsers: 5 },
    features: { surveillance: true, diseaseLibrary: true, reports: true },
    priceCents: 0,
  },
  {
    code: 'ENTERPRISE',
    name: 'Enterprise',
    limits: { maxAnimals: null, maxLots: null, maxUsers: null },
    features: { surveillance: true, diseaseLibrary: true, reports: true },
    priceCents: 0,
  },
];

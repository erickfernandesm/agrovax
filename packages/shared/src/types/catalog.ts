import { z } from 'zod';
import { PLAN_CODES, RISK_LEVELS, SPECIES, SUBSCRIPTION_STATUSES } from '../domain/enums';
import type { RiskLevel, Species } from '../domain/enums';
import { isValidIsoDate } from '../logic/dates';
import { BR_STATES } from '../validation/farm';

/** Catalogos globais (somente leitura no app) e seus schemas de administracao. */

export interface DiseaseDto {
  id: string;
  slug: string;
  name: string;
  species: Species[];
  causativeAgent: string | null;
  transmission: string | null;
  mainSymptoms: string | null;
  prevention: string | null;
  availableVaccines: string | null;
  preventiveMedications: string | null;
  riskLevel: RiskLevel | null;
  source: string | null;
  isDemo: boolean;
  /** Sintomas do catalogo associados (uso educativo, nunca diagnostico). */
  symptomIds: string[];
}

export interface SymptomDto {
  id: string;
  slug: string;
  name: string;
  isDemo: boolean;
}

export interface SurveillanceAlertDto {
  id: string;
  diseaseId: string | null;
  diseaseName: string;
  state: string | null;
  region: string;
  reportedAt: string;
  riskLevel: RiskLevel;
  description: string;
  guidance: string;
  sourceName: string;
  sourceUrl: string | null;
  isDemo: boolean;
}

export interface CatalogDto {
  /** Muda sempre que qualquer item do catalogo muda. */
  version: string;
  diseases: DiseaseDto[];
  symptoms: SymptomDto[];
  surveillanceAlerts: SurveillanceAlertDto[];
}

export type CatalogResponse = CatalogDto | { version: string; unchanged: true };

// ------------------------------------------------------------ administracao

const slug = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'Use letras minúsculas, números e hífens.')
  .max(80);
const longText = z.string().trim().max(4000).nullable().optional();

export const diseaseInputSchema = z.object({
  slug,
  name: z.string().trim().min(2).max(120),
  species: z.array(z.enum(SPECIES)).min(1),
  causativeAgent: longText,
  transmission: longText,
  mainSymptoms: longText,
  prevention: longText,
  availableVaccines: longText,
  preventiveMedications: longText,
  riskLevel: z.enum(RISK_LEVELS).nullable().optional(),
  source: z.string().trim().max(300).nullable().optional(),
  isDemo: z.boolean().default(false),
  published: z.boolean().default(true),
  symptomIds: z.array(z.uuid()).max(100).optional(),
});
export type DiseaseInput = z.infer<typeof diseaseInputSchema>;
export const diseaseUpdateSchema = diseaseInputSchema.partial();

export const symptomInputSchema = z.object({
  slug,
  name: z.string().trim().min(2).max(120),
  isDemo: z.boolean().default(false),
});
export type SymptomInput = z.infer<typeof symptomInputSchema>;
export const symptomUpdateSchema = symptomInputSchema.partial();

export const surveillanceInputSchema = z.object({
  diseaseId: z.uuid().nullable().optional(),
  diseaseName: z.string().trim().min(2).max(120),
  state: z.enum(BR_STATES).nullable().optional(),
  region: z.string().trim().min(2).max(160),
  reportedAt: z.string().refine(isValidIsoDate, 'Data inválida.'),
  riskLevel: z.enum(RISK_LEVELS),
  description: z.string().trim().min(2).max(4000),
  guidance: z.string().trim().min(2).max(4000),
  /** A fonte e obrigatoria: nenhum alerta e publicado sem origem identificada. */
  sourceName: z.string().trim().min(2).max(200),
  sourceUrl: z.url().max(500).nullable().optional(),
  isDemo: z.boolean().default(false),
  active: z.boolean().default(true),
});
export type SurveillanceInput = z.infer<typeof surveillanceInputSchema>;
export const surveillanceUpdateSchema = surveillanceInputSchema.partial();

export const planUpdateSchema = z.object({
  name: z.string().trim().min(2).max(60).optional(),
  limits: z
    .object({
      maxAnimals: z.number().int().min(0).nullable(),
      maxLots: z.number().int().min(0).nullable(),
      maxUsers: z.number().int().min(1).nullable(),
    })
    .optional(),
  features: z.record(z.string(), z.boolean()).optional(),
  priceCents: z.number().int().min(0).optional(),
  active: z.boolean().optional(),
});
export type PlanUpdateInput = z.infer<typeof planUpdateSchema>;

export const subscriptionUpdateSchema = z.object({
  plan: z.enum(PLAN_CODES).optional(),
  status: z.enum(SUBSCRIPTION_STATUSES).optional(),
  expiresAt: z.iso.datetime().nullable().optional(),
});
export type SubscriptionUpdateInput = z.infer<typeof subscriptionUpdateSchema>;

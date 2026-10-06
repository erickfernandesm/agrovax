/**
 * Enums de dominio do AgroVax.
 *
 * Sao declarados como tuplas `as const` para servirem ao mesmo tempo de tipo
 * TypeScript, de fonte para os schemas zod e de espelho dos enums do Prisma.
 * Os valores sao estaveis (gravados no banco); os rotulos em portugues ficam
 * em `labels.ts`.
 */

export const SPECIES = ['BOVINE', 'EQUINE'] as const;
export type Species = (typeof SPECIES)[number];

export const SEXES = ['MALE', 'FEMALE'] as const;
export type Sex = (typeof SEXES)[number];

export const ANIMAL_STATUSES = ['ACTIVE', 'SOLD', 'DEAD', 'TRANSFERRED'] as const;
export type AnimalStatus = (typeof ANIMAL_STATUSES)[number];

/** Finalidade produtiva (apenas bovinos). */
export const PURPOSES = ['BEEF', 'DAIRY'] as const;
export type Purpose = (typeof PURPOSES)[number];

export const BOVINE_CATEGORIES = ['CALF', 'HEIFER', 'COW', 'BULL', 'STEER'] as const;
export const EQUINE_CATEGORIES = ['HORSE', 'MARE', 'FOAL', 'STALLION'] as const;
export const CATEGORIES = [...BOVINE_CATEGORIES, ...EQUINE_CATEGORIES] as const;
export type Category = (typeof CATEGORIES)[number];

export const CATEGORIES_BY_SPECIES: Record<Species, readonly Category[]> = {
  BOVINE: BOVINE_CATEGORIES,
  EQUINE: EQUINE_CATEGORIES,
};

export const TREATMENT_TYPES = ['DEWORMER', 'TICK_CONTROL', 'FLY_CONTROL', 'OTHER'] as const;
export type TreatmentType = (typeof TREATMENT_TYPES)[number];

export const SYMPTOM_INTENSITIES = ['MILD', 'MODERATE', 'SEVERE'] as const;
export type SymptomIntensity = (typeof SYMPTOM_INTENSITIES)[number];

export const RISK_LEVELS = ['LOW', 'MEDIUM', 'HIGH'] as const;
export type RiskLevel = (typeof RISK_LEVELS)[number];

export const HEALTH_EVENT_TYPES = ['EXAM', 'VET_VISIT', 'NOTE', 'OTHER'] as const;
export type HealthEventType = (typeof HEALTH_EVENT_TYPES)[number];

export const ALERT_KINDS = [
  'VACCINATION_DUE',
  'VACCINATION_OVERDUE',
  'TREATMENT_DUE',
  'TREATMENT_OVERDUE',
] as const;
export type AlertKind = (typeof ALERT_KINDS)[number];

export const MEMBER_ROLES = ['OWNER', 'MANAGER', 'WORKER'] as const;
export type MemberRole = (typeof MEMBER_ROLES)[number];

export const PLAN_CODES = ['FREE', 'PRO', 'ENTERPRISE'] as const;
export type PlanCode = (typeof PLAN_CODES)[number];

export const SUBSCRIPTION_STATUSES = [
  'ACTIVE',
  'TRIALING',
  'PAST_DUE',
  'CANCELED',
  'EXPIRED',
] as const;
export type SubscriptionStatus = (typeof SUBSCRIPTION_STATUSES)[number];

/** Estado de sincronizacao exibido na interface. */
export const SYNC_STATES = ['SYNCED', 'SYNCING', 'OFFLINE', 'ERROR'] as const;
export type SyncState = (typeof SYNC_STATES)[number];

/** Antecedencias (em dias) dos avisos de vacinacao. */
export const VACCINATION_ALERT_THRESHOLDS_DAYS = [30, 15, 7] as const;

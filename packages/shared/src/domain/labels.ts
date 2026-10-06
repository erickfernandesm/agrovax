import type {
  AnimalStatus,
  Category,
  MemberRole,
  PlanCode,
  Purpose,
  RiskLevel,
  Sex,
  Species,
  SymptomIntensity,
  SyncState,
  TreatmentType,
} from './enums';

/** Rotulos em portugues usados pela interface. */

export const SPECIES_LABEL: Record<Species, string> = {
  BOVINE: 'Bovino',
  EQUINE: 'Equino',
};

export const SEX_LABEL: Record<Sex, string> = {
  MALE: 'Macho',
  FEMALE: 'Fêmea',
};

export const ANIMAL_STATUS_LABEL: Record<AnimalStatus, string> = {
  ACTIVE: 'Ativo',
  SOLD: 'Vendido',
  DEAD: 'Morto',
  TRANSFERRED: 'Transferido',
};

export const PURPOSE_LABEL: Record<Purpose, string> = {
  BEEF: 'Corte',
  DAIRY: 'Leite',
};

export const CATEGORY_LABEL: Record<Category, string> = {
  CALF: 'Bezerros',
  HEIFER: 'Novilhas',
  COW: 'Vacas',
  BULL: 'Touros',
  STEER: 'Garrotes',
  HORSE: 'Cavalos',
  MARE: 'Éguas',
  FOAL: 'Potros',
  STALLION: 'Garanhões',
};

export const TREATMENT_TYPE_LABEL: Record<TreatmentType, string> = {
  DEWORMER: 'Vermífugo',
  TICK_CONTROL: 'Controle de carrapatos',
  FLY_CONTROL: 'Controle de moscas',
  OTHER: 'Outros tratamentos preventivos',
};

export const SYMPTOM_INTENSITY_LABEL: Record<SymptomIntensity, string> = {
  MILD: 'Leve',
  MODERATE: 'Moderada',
  SEVERE: 'Intensa',
};

export const RISK_LEVEL_LABEL: Record<RiskLevel, string> = {
  LOW: 'Baixo',
  MEDIUM: 'Médio',
  HIGH: 'Alto',
};

export const MEMBER_ROLE_LABEL: Record<MemberRole, string> = {
  OWNER: 'Proprietário',
  MANAGER: 'Gerente',
  WORKER: 'Colaborador',
};

export const PLAN_LABEL: Record<PlanCode, string> = {
  FREE: 'Gratuito',
  PRO: 'Pro',
  ENTERPRISE: 'Enterprise',
};

export const SYNC_STATE_LABEL: Record<SyncState, string> = {
  SYNCED: 'Sincronizado',
  SYNCING: 'Sincronizando',
  OFFLINE: 'Offline',
  ERROR: 'Erro de sincronização',
};

/** Aviso exibido em todo conteudo de saude do aplicativo. */
export const VET_DISCLAIMER =
  'As informações do AgroVax são educativas e de acompanhamento. Elas não substituem a avaliação de um médico-veterinário.';

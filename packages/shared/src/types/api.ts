import type { MemberRole, PlanCode, SubscriptionStatus } from '../domain/enums';

/** Contratos de resposta da API REST (compartilhados com o app). */

export interface UserDto {
  id: string;
  name: string;
  email: string;
  isPlatformAdmin: boolean;
}

export interface PlanLimits {
  /** `null` significa sem limite. */
  maxAnimals: number | null;
  maxLots: number | null;
  maxUsers: number | null;
}

export interface SubscriptionDto {
  plan: PlanCode;
  status: SubscriptionStatus;
  expiresAt: string | null;
  limits: PlanLimits;
  features: Record<string, boolean>;
}

export interface FarmDto {
  id: string;
  name: string;
  city: string | null;
  state: string | null;
  role: MemberRole;
  subscription: SubscriptionDto;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  /** Validade do access token, em segundos. */
  expiresIn: number;
}

export interface AuthResponse extends AuthTokens {
  user: UserDto;
  farms: FarmDto[];
}

export interface MeResponse {
  user: UserDto;
  farms: FarmDto[];
}

export interface ApiErrorBody {
  error: {
    /** Codigo estavel, em ingles, para tratamento programatico. */
    code: string;
    /** Mensagem em portugues, propria para exibicao. */
    message: string;
    /** Erros por campo, quando a validacao falha. */
    fields?: Record<string, string>;
  };
}

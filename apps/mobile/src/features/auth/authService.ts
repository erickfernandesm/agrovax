import type {
  AuthResponse,
  FarmDto,
  ForgotPasswordInput,
  LoginInput,
  MeResponse,
  RegisterInput,
  ResetPasswordInput,
  UpdateFarmInput,
} from '@agrovax/shared';
import { api } from '../../services/container';
import { profileStore, tokenStore, type StoredProfile } from '../../services/session/sessionStorage';

/**
 * Regras de sessao do app: fala com a API e mantem a copia local do perfil.
 * As telas nunca chamam a API nem o armazenamento diretamente.
 */

function pickActiveFarm(farms: FarmDto[], preferred: string | null): string | null {
  if (preferred && farms.some((farm) => farm.id === preferred)) return preferred;
  return farms[0]?.id ?? null;
}

async function openSession(response: AuthResponse): Promise<StoredProfile> {
  const { user, farms, ...tokens } = response;
  const profile: StoredProfile = { user, farms, activeFarmId: pickActiveFarm(farms, null) };
  await tokenStore.set(tokens);
  await profileStore.set(profile);
  return profile;
}

export const authService = {
  /** Sessao salva no aparelho (funciona offline). */
  async restore(): Promise<StoredProfile | null> {
    const [tokens, profile] = await Promise.all([tokenStore.get(), profileStore.get()]);
    return tokens && profile ? profile : null;
  },

  async signIn(input: LoginInput): Promise<StoredProfile> {
    return openSession(await api.post<AuthResponse>('/v1/auth/login', input, { auth: false }));
  },

  async signUp(input: RegisterInput): Promise<StoredProfile> {
    return openSession(await api.post<AuthResponse>('/v1/auth/register', input, { auth: false }));
  },

  /** Encerra a sessao local sempre; avisa o servidor quando houver conexao. */
  async signOut(): Promise<void> {
    const tokens = await tokenStore.get();
    await tokenStore.clear();
    await profileStore.clear();
    if (tokens) {
      await api
        .post('/v1/auth/logout', { refreshToken: tokens.refreshToken }, { auth: false })
        .catch(() => undefined);
    }
  },

  async clearLocalSession(): Promise<void> {
    await tokenStore.clear();
    await profileStore.clear();
  },

  /** Atualiza usuario e fazendas a partir do servidor. */
  async refreshProfile(current: StoredProfile): Promise<StoredProfile> {
    const me = await api.get<MeResponse>('/v1/me');
    const profile: StoredProfile = {
      user: me.user,
      farms: me.farms,
      activeFarmId: pickActiveFarm(me.farms, current.activeFarmId),
    };
    await profileStore.set(profile);
    return profile;
  },

  async updateFarm(
    current: StoredProfile,
    farmId: string,
    input: UpdateFarmInput,
  ): Promise<StoredProfile> {
    const { farm } = await api.patch<{ farm: FarmDto }>(`/v1/farms/${farmId}`, input);
    const profile: StoredProfile = {
      ...current,
      farms: current.farms.map((item) => (item.id === farm.id ? farm : item)),
    };
    await profileStore.set(profile);
    return profile;
  },

  async requestPasswordReset(input: ForgotPasswordInput): Promise<void> {
    await api.post('/v1/auth/forgot-password', input, { auth: false });
  },

  async resetPassword(input: ResetPasswordInput): Promise<void> {
    await api.post('/v1/auth/reset-password', input, { auth: false });
  },
};

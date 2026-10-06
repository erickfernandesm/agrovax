import type { AuthTokens, FarmDto, UserDto } from '@agrovax/shared';
import * as SecureStore from 'expo-secure-store';
import Storage from 'expo-sqlite/kv-store';
import type { TokenStore } from '../api/client';

/**
 * Persistencia da sessao no aparelho.
 *
 * - Tokens: armazenamento seguro do sistema (Keychain / Keystore).
 * - Perfil (usuario, fazendas, fazenda ativa): banco local, para que o app
 *   abra ja autenticado mesmo sem internet.
 */

const TOKENS_KEY = 'agrovax.tokens';
const PROFILE_KEY = 'agrovax.profile';

export interface StoredProfile {
  user: UserDto;
  farms: FarmDto[];
  activeFarmId: string | null;
}

/** Guarda os tokens em memoria apos a primeira leitura para evitar I/O a cada requisicao. */
class SecureTokenStore implements TokenStore {
  private cached: AuthTokens | null | undefined;

  async get(): Promise<AuthTokens | null> {
    if (this.cached === undefined) {
      const raw = await SecureStore.getItemAsync(TOKENS_KEY);
      this.cached = raw ? (JSON.parse(raw) as AuthTokens) : null;
    }
    return this.cached;
  }

  async set(tokens: AuthTokens): Promise<void> {
    this.cached = tokens;
    await SecureStore.setItemAsync(TOKENS_KEY, JSON.stringify(tokens));
  }

  async clear(): Promise<void> {
    this.cached = null;
    await SecureStore.deleteItemAsync(TOKENS_KEY);
  }
}

export const tokenStore: TokenStore = new SecureTokenStore();

export const profileStore = {
  async get(): Promise<StoredProfile | null> {
    const raw = await Storage.getItem(PROFILE_KEY);
    return raw ? (JSON.parse(raw) as StoredProfile) : null;
  },
  async set(profile: StoredProfile): Promise<void> {
    await Storage.setItem(PROFILE_KEY, JSON.stringify(profile));
  },
  async clear(): Promise<void> {
    await Storage.removeItem(PROFILE_KEY);
  },
};

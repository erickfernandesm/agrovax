import type { AuthTokens } from '@agrovax/shared';
import type { TokenStore } from '../api/client';
import type { StoredProfile } from './sessionStorage';

/**
 * Versao WEB da persistencia de sessao, usada apenas na pre-visualizacao pelo
 * navegador durante o desenvolvimento. O armazenamento seguro e o SQLite do
 * aparelho nao existem no navegador, entao usa-se localStorage.
 * O produto final e o aplicativo Android/iOS (veja sessionStorage.ts).
 */

const TOKENS_KEY = 'agrovax.tokens';
const PROFILE_KEY = 'agrovax.profile';

export type { StoredProfile };

function read<T>(key: string): T | null {
  const raw = globalThis.localStorage?.getItem(key);
  return raw ? (JSON.parse(raw) as T) : null;
}

export const tokenStore: TokenStore = {
  get: async () => read<AuthTokens>(TOKENS_KEY),
  set: async (tokens) => globalThis.localStorage?.setItem(TOKENS_KEY, JSON.stringify(tokens)),
  clear: async () => globalThis.localStorage?.removeItem(TOKENS_KEY),
};

export const profileStore = {
  get: async () => read<StoredProfile>(PROFILE_KEY),
  set: async (profile: StoredProfile) =>
    globalThis.localStorage?.setItem(PROFILE_KEY, JSON.stringify(profile)),
  clear: async () => globalThis.localStorage?.removeItem(PROFILE_KEY),
};

import { API_URL } from '../config/env';
import { ApiClient } from './api/client';
import { tokenStore } from './session/sessionStorage';

/** Ponto unico de montagem dos servicos do app. */

type Listener = () => void;
const sessionExpiredListeners = new Set<Listener>();

/** Avisa quando o servidor encerrou a sessao (refresh token recusado). */
export function onSessionExpired(listener: Listener): () => void {
  sessionExpiredListeners.add(listener);
  return () => {
    sessionExpiredListeners.delete(listener);
  };
}

export const api = new ApiClient({
  baseUrl: API_URL,
  tokens: tokenStore,
  onSessionExpired: () => sessionExpiredListeners.forEach((listener) => listener()),
});

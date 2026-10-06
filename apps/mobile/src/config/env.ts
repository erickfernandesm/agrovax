const DEFAULT_API_URL = 'http://10.0.2.2:3333';
const DEV_API_PORT = 3333;

/**
 * Endereco base da API.
 *
 * - Aplicativo (Android/iOS): EXPO_PUBLIC_API_URL (veja .env.example).
 * - Navegador em desenvolvimento: a API e procurada na mesma maquina que
 *   serviu a pagina, na porta 3333. Assim "localhost" funciona mesmo quando
 *   EXPO_PUBLIC_API_URL aponta para o IP da rede (usado pelo celular).
 * - Navegador em producao: EXPO_PUBLIC_API_URL, se definida no build; senao
 *   "/api" no mesmo dominio do site, que e encaminhado para a API pela
 *   funcao em `functions/api`. Mesmo dominio dispensa configuracao de CORS.
 */
function resolveApiUrl(): string {
  const configured = (process.env.EXPO_PUBLIC_API_URL || '').replace(/\/+$/, '');
  const location = (globalThis as { location?: { hostname?: string; origin?: string } }).location;

  if (location?.hostname) {
    if (__DEV__) return `http://${location.hostname}:${DEV_API_PORT}`;
    return configured || `${location.origin}/api`;
  }
  return configured || DEFAULT_API_URL;
}

export const API_URL = resolveApiUrl();

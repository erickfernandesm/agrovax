const DEFAULT_API_URL = 'http://10.0.2.2:3333';
const DEV_API_PORT = 3333;

/**
 * Endereco base da API.
 *
 * - Aplicativo (Android/iOS): EXPO_PUBLIC_API_URL (veja .env.example).
 * - Pre-visualizacao pelo navegador em desenvolvimento: a API e procurada na
 *   mesma maquina que serviu a pagina. Assim "localhost" continua funcionando
 *   mesmo quando EXPO_PUBLIC_API_URL aponta para o IP da rede (usado pelo
 *   celular), que o navegador pode nao alcancar por causa de proxy ou antivirus.
 */
function resolveApiUrl(): string {
  const location = (globalThis as { location?: { hostname?: string } }).location;
  if (__DEV__ && location?.hostname) {
    return `http://${location.hostname}:${DEV_API_PORT}`;
  }
  return (process.env.EXPO_PUBLIC_API_URL ?? DEFAULT_API_URL).replace(/\/+$/, '');
}

export const API_URL = resolveApiUrl();

import type { ApiErrorBody, AuthTokens } from '@agrovax/shared';

/**
 * Cliente HTTP da API AgroVax.
 *
 * Este arquivo nao importa nada do React Native: recebe `fetch` e o
 * armazenamento de tokens por injecao, o que permite testa-lo em Node.
 *
 * Regra central para uso no campo: falha de REDE nunca encerra a sessao.
 * O usuario so e deslogado quando o servidor responde que o refresh token
 * nao vale mais.
 */

/** O servidor respondeu com erro (4xx/5xx). */
export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly fields?: Record<string, string>,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/** Nao foi possivel falar com o servidor (sem sinal, timeout, DNS...). */
export class NetworkError extends Error {
  constructor() {
    super('Sem conexão com o servidor. Verifique a internet e tente de novo.');
    this.name = 'NetworkError';
  }
}

export interface TokenStore {
  get(): Promise<AuthTokens | null>;
  set(tokens: AuthTokens): Promise<void>;
  clear(): Promise<void>;
}

export interface ApiClientOptions {
  baseUrl: string;
  tokens: TokenStore;
  fetchFn?: typeof fetch;
  timeoutMs?: number;
  /** Chamado quando o servidor recusa o refresh token (sessao realmente encerrada). */
  onSessionExpired?: () => void;
}

interface RequestOptions {
  body?: unknown;
  /** Rotas publicas (login, cadastro) nao enviam token. */
  auth?: boolean;
}

type Method = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';

export class ApiClient {
  private readonly baseUrl: string;
  private readonly tokens: TokenStore;
  private readonly fetchFn: typeof fetch;
  private readonly timeoutMs: number;
  private readonly onSessionExpired: () => void;
  /** Renovacao em andamento, compartilhada por requisicoes simultaneas. */
  private refreshing: Promise<AuthTokens> | null = null;

  constructor(options: ApiClientOptions) {
    this.baseUrl = options.baseUrl;
    this.tokens = options.tokens;
    // Chamada indireta: no navegador, `fetch` falha se for invocado como metodo de outro objeto.
    this.fetchFn = options.fetchFn ?? ((input, init) => fetch(input, init));
    this.timeoutMs = options.timeoutMs ?? 15_000;
    this.onSessionExpired = options.onSessionExpired ?? (() => undefined);
  }

  get<T>(path: string, options?: RequestOptions): Promise<T> {
    return this.request<T>('GET', path, options);
  }

  post<T>(path: string, body?: unknown, options?: RequestOptions): Promise<T> {
    return this.request<T>('POST', path, { ...options, body });
  }

  patch<T>(path: string, body?: unknown, options?: RequestOptions): Promise<T> {
    return this.request<T>('PATCH', path, { ...options, body });
  }

  private async request<T>(method: Method, path: string, options: RequestOptions = {}): Promise<T> {
    const useAuth = options.auth ?? true;
    if (!useAuth) return this.send<T>(method, path, options.body, null);

    const current = await this.tokens.get();
    if (!current) {
      this.onSessionExpired();
      throw new ApiError(401, 'UNAUTHORIZED', 'Sessão encerrada. Entre novamente.');
    }

    try {
      return await this.send<T>(method, path, options.body, current.accessToken);
    } catch (error) {
      if (!(error instanceof ApiError) || error.status !== 401) throw error;
      // Access token vencido: renova uma vez e repete a requisicao.
      const renewed = await this.refresh(current.refreshToken);
      return this.send<T>(method, path, options.body, renewed.accessToken);
    }
  }

  private refresh(refreshToken: string): Promise<AuthTokens> {
    if (!this.refreshing) {
      this.refreshing = this.doRefresh(refreshToken).finally(() => {
        this.refreshing = null;
      });
    }
    return this.refreshing;
  }

  private async doRefresh(refreshToken: string): Promise<AuthTokens> {
    // Outra requisicao pode ja ter renovado enquanto esta aguardava.
    const stored = await this.tokens.get();
    if (stored && stored.refreshToken !== refreshToken) return stored;

    try {
      const tokens = await this.send<AuthTokens>('POST', '/v1/auth/refresh', { refreshToken }, null);
      await this.tokens.set(tokens);
      return tokens;
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        await this.tokens.clear();
        this.onSessionExpired();
      }
      throw error;
    }
  }

  private async send<T>(
    method: Method,
    path: string,
    body: unknown,
    accessToken: string | null,
  ): Promise<T> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    let response: Response;
    try {
      response = await this.fetchFn(`${this.baseUrl}${path}`, {
        method,
        headers: {
          Accept: 'application/json',
          ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
        body: body !== undefined ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });
    } catch {
      throw new NetworkError();
    } finally {
      clearTimeout(timer);
    }

    if (response.status === 204) return undefined as T;

    let payload: unknown;
    try {
      payload = await response.json();
    } catch {
      payload = null;
    }

    if (!response.ok) {
      const error = (payload as ApiErrorBody | null)?.error;
      throw new ApiError(
        response.status,
        error?.code ?? 'UNKNOWN_ERROR',
        error?.message ?? 'Não foi possível concluir a operação.',
        error?.fields,
      );
    }
    return payload as T;
  }
}

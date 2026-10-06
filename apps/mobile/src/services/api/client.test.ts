import type { AuthTokens } from '@agrovax/shared';
import { describe, expect, it, vi } from 'vitest';
import { ApiClient, ApiError, NetworkError, type TokenStore } from './client';

function memoryStore(initial: AuthTokens | null): TokenStore & { current: AuthTokens | null } {
  const store = {
    current: initial,
    get: async () => store.current,
    set: async (tokens: AuthTokens) => {
      store.current = tokens;
    },
    clear: async () => {
      store.current = null;
    },
  };
  return store;
}

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

const OLD: AuthTokens = { accessToken: 'access-old', refreshToken: 'refresh-old', expiresIn: 900 };
const NEW: AuthTokens = { accessToken: 'access-new', refreshToken: 'refresh-new', expiresIn: 900 };
const unauthorized = () => json(401, { error: { code: 'UNAUTHORIZED', message: 'expirou' } });

function authHeader(init: RequestInit | undefined): string | undefined {
  return (init?.headers as Record<string, string> | undefined)?.Authorization;
}

describe('ApiClient', () => {
  it('envia o access token nas rotas protegidas', async () => {
    const fetchFn = vi.fn(async () => json(200, { ok: true }));
    const client = new ApiClient({ baseUrl: 'http://api', tokens: memoryStore(OLD), fetchFn });

    await client.get('/v1/me');

    const [url, init] = fetchFn.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('http://api/v1/me');
    expect(authHeader(init)).toBe('Bearer access-old');
  });

  it('renova o token ao receber 401 e repete a requisicao', async () => {
    const store = memoryStore(OLD);
    const fetchFn = vi.fn(async (url: string, init?: RequestInit) => {
      if (url.endsWith('/v1/auth/refresh')) return json(200, NEW);
      return authHeader(init) === 'Bearer access-new' ? json(200, { ok: true }) : unauthorized();
    });
    const client = new ApiClient({
      baseUrl: 'http://api',
      tokens: store,
      fetchFn: fetchFn as unknown as typeof fetch,
    });

    await expect(client.get('/v1/me')).resolves.toEqual({ ok: true });
    expect(store.current).toEqual(NEW);
  });

  it('faz uma unica renovacao para requisicoes simultaneas', async () => {
    const store = memoryStore(OLD);
    let refreshCalls = 0;
    const fetchFn = async (url: string, init?: RequestInit) => {
      if (url.endsWith('/v1/auth/refresh')) {
        refreshCalls += 1;
        await new Promise((resolve) => setTimeout(resolve, 10));
        return json(200, NEW);
      }
      return authHeader(init) === 'Bearer access-new' ? json(200, { ok: true }) : unauthorized();
    };
    const client = new ApiClient({
      baseUrl: 'http://api',
      tokens: store,
      fetchFn: fetchFn as unknown as typeof fetch,
    });

    await Promise.all([client.get('/a'), client.get('/b'), client.get('/c')]);
    expect(refreshCalls).toBe(1);
  });

  it('encerra a sessao quando o servidor recusa o refresh token', async () => {
    const store = memoryStore(OLD);
    const onSessionExpired = vi.fn();
    const client = new ApiClient({
      baseUrl: 'http://api',
      tokens: store,
      fetchFn: (async () => unauthorized()) as unknown as typeof fetch,
      onSessionExpired,
    });

    await expect(client.get('/v1/me')).rejects.toBeInstanceOf(ApiError);
    expect(onSessionExpired).toHaveBeenCalledTimes(1);
    expect(store.current).toBeNull();
  });

  it('falha de rede NAO encerra a sessao nem apaga os tokens', async () => {
    const store = memoryStore(OLD);
    const onSessionExpired = vi.fn();
    const client = new ApiClient({
      baseUrl: 'http://api',
      tokens: store,
      fetchFn: (async () => {
        throw new TypeError('Network request failed');
      }) as unknown as typeof fetch,
      onSessionExpired,
    });

    await expect(client.get('/v1/me')).rejects.toBeInstanceOf(NetworkError);
    expect(onSessionExpired).not.toHaveBeenCalled();
    expect(store.current).toEqual(OLD);
  });

  it('falha de rede durante a renovacao tambem preserva a sessao', async () => {
    const store = memoryStore(OLD);
    const onSessionExpired = vi.fn();
    const fetchFn = async (url: string) => {
      if (url.endsWith('/v1/auth/refresh')) throw new TypeError('Network request failed');
      return unauthorized();
    };
    const client = new ApiClient({
      baseUrl: 'http://api',
      tokens: store,
      fetchFn: fetchFn as unknown as typeof fetch,
      onSessionExpired,
    });

    await expect(client.get('/v1/me')).rejects.toBeInstanceOf(NetworkError);
    expect(onSessionExpired).not.toHaveBeenCalled();
    expect(store.current).toEqual(OLD);
  });

  it('converte o erro da API em ApiError com codigo e campos', async () => {
    const client = new ApiClient({
      baseUrl: 'http://api',
      tokens: memoryStore(null),
      fetchFn: (async () =>
        json(400, {
          error: { code: 'VALIDATION_ERROR', message: 'Verifique', fields: { email: 'inválido' } },
        })) as unknown as typeof fetch,
    });

    const error = await client.post('/v1/auth/login', {}, { auth: false }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 400, code: 'VALIDATION_ERROR', fields: { email: 'inválido' } });
  });

  it('rotas publicas nao enviam token', async () => {
    const fetchFn = vi.fn(async () => json(200, {}));
    const client = new ApiClient({ baseUrl: 'http://api', tokens: memoryStore(OLD), fetchFn });
    await client.post('/v1/auth/login', { email: 'a@b.com' }, { auth: false });
    const [, init] = fetchFn.mock.calls[0] as unknown as [string, RequestInit];
    expect(authHeader(init)).toBeUndefined();
  });
});

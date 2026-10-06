/**
 * Cloudflare Pages Function: encaminha /api/* do site para a API do AgroVax.
 *
 * O endereco da API vem da variavel de ambiente API_ORIGIN do projeto no
 * Pages (ex.: https://api.exemplo.com.br). Com o site e a API no mesmo
 * dominio, o navegador nao precisa de CORS e o build do app nao depende do
 * endereco da API.
 */
export async function onRequest({ request, env, params }) {
  const origin = (env.API_ORIGIN || '').replace(/\/+$/, '');
  if (!origin) {
    return Response.json(
      {
        error: {
          code: 'API_NOT_CONFIGURED',
          message: 'O servidor do AgroVax ainda não está configurado para este endereço.',
        },
      },
      { status: 503 },
    );
  }

  const path = Array.isArray(params.path) ? params.path.join('/') : (params.path ?? '');
  const target = new URL(`${origin}/${path}`);
  target.search = new URL(request.url).search;

  const headers = new Headers(request.headers);
  headers.delete('host');
  // A origem do navegador nao e repassada: para a API, a chamada vem do site.
  headers.delete('origin');
  // Repassa o IP real do visitante, usado pelo limite de requisicoes da API.
  const clientIp = request.headers.get('cf-connecting-ip');
  if (clientIp) headers.set('x-forwarded-for', clientIp);

  try {
    return await fetch(target, {
      method: request.method,
      headers,
      body: request.method === 'GET' || request.method === 'HEAD' ? undefined : request.body,
      redirect: 'manual',
    });
  } catch {
    return Response.json(
      { error: { code: 'API_UNREACHABLE', message: 'Não foi possível falar com o servidor.' } },
      { status: 502 },
    );
  }
}

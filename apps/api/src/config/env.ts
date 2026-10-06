import 'dotenv/config';
import { z } from 'zod';

/**
 * Configuracao lida exclusivamente de variaveis de ambiente.
 * A aplicacao nao sobe se algo obrigatorio estiver ausente ou invalido.
 */
const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3333),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL e obrigatoria.'),

  JWT_ACCESS_SECRET: z.string().min(32, 'JWT_ACCESS_SECRET deve ter pelo menos 32 caracteres.'),
  ACCESS_TOKEN_TTL_MINUTES: z.coerce.number().int().min(1).default(15),
  /** Validade longa: o produtor pode passar semanas sem conexao. */
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().min(1).default(90),

  /** Origens permitidas (CORS), separadas por virgula. Vazio = nenhuma origem de navegador. */
  CORS_ORIGINS: z.string().default(''),
  /** Numero de proxies confiaveis a frente da API (para o IP real no rate limit). */
  TRUST_PROXY: z.coerce.number().int().min(0).default(0),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),

  /** Endereco de um feed JSON de alertas de vigilancia sanitaria (opcional). */
  SURVEILLANCE_FEED_URL: z.url().optional().or(z.literal('').transform(() => undefined)),

  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().default(587),
  SMTP_USER: z.string().optional(),
  SMTP_PASSWORD: z.string().optional(),
  MAIL_FROM: z.string().default('AgroVax <nao-responda@agrovax.app>'),
});

export type Env = z.infer<typeof schema>;

function loadEnv(): Env {
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    const problems = parsed.error.issues
      .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');
    throw new Error(`Configuracao de ambiente invalida:\n${problems}`);
  }
  return parsed.data;
}

export const env = loadEnv();

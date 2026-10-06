import type { z } from 'zod';
import { errors } from './errors';

/**
 * Valida dados de entrada com um schema zod. Em caso de falha lanca um
 * erro 400 com a primeira mensagem de cada campo.
 */
export function parse<S extends z.ZodType>(schema: S, data: unknown): z.infer<S> {
  const result = schema.safeParse(data);
  if (result.success) return result.data;

  const fields: Record<string, string> = {};
  for (const issue of result.error.issues) {
    const key = issue.path.join('.') || '_';
    if (!(key in fields)) fields[key] = issue.message;
  }
  throw errors.validation(fields);
}

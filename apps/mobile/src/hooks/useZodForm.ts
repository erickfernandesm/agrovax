import { useCallback, useState } from 'react';
import type { z } from 'zod';
import { ApiError } from '../services/api/client';

type Errors<T> = Partial<Record<keyof T, string>>;

/**
 * Formulario simples validado por um schema zod compartilhado com a API.
 * `submit` valida, executa a acao e traduz erros da API em mensagens:
 * erros por campo voltam para os campos; os demais viram `formError`.
 */
export function useZodForm<Values extends Record<string, string>, Output>(
  schema: z.ZodType<Output, Values>,
  initial: Values,
) {
  const [values, setValues] = useState<Values>(initial);
  const [errors, setErrors] = useState<Errors<Values>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const setField = useCallback(<K extends keyof Values>(field: K, value: Values[K]) => {
    setValues((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
  }, []);

  const submit = useCallback(
    async (action: (data: Output) => Promise<void>): Promise<boolean> => {
      setFormError(null);
      const parsed = schema.safeParse(values);
      if (!parsed.success) {
        const next: Errors<Values> = {};
        for (const issue of parsed.error.issues) {
          const key = issue.path[0] as keyof Values | undefined;
          if (key !== undefined && next[key] === undefined) next[key] = issue.message;
        }
        setErrors(next);
        return false;
      }

      setErrors({});
      setSubmitting(true);
      try {
        await action(parsed.data);
        return true;
      } catch (error) {
        if (error instanceof ApiError && error.fields) {
          setErrors(error.fields as Errors<Values>);
        }
        setFormError(
          error instanceof Error ? error.message : 'Não foi possível concluir a operação.',
        );
        return false;
      } finally {
        setSubmitting(false);
      }
    },
    [schema, values],
  );

  return { values, errors, formError, submitting, setField, submit };
}

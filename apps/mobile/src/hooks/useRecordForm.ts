import { useCallback, useState } from 'react';
import { ValidationError } from '../data/store/LocalStore';

/**
 * Estado de um formulario que grava no banco local.
 * `submit` executa a gravacao e distribui os erros de validacao pelos campos.
 */
export function useRecordForm<Values extends object>(initial: Values) {
  const [values, setValues] = useState<Values>(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const set = useCallback(<K extends keyof Values>(field: K, value: Values[K]) => {
    setValues((current) => ({ ...current, [field]: value }));
    setErrors((current) => {
      if (!(field in current)) return current;
      const { [field as string]: _removed, ...rest } = current;
      return rest;
    });
  }, []);

  const submit = useCallback(async (action: () => Promise<void>): Promise<boolean> => {
    setFormError(null);
    setErrors({});
    setSaving(true);
    try {
      await action();
      return true;
    } catch (error) {
      if (error instanceof ValidationError) {
        setErrors(error.fields);
        setFormError(error.fields._ ?? 'Verifique os campos destacados.');
      } else {
        setFormError(error instanceof Error ? error.message : 'Não foi possível salvar.');
      }
      return false;
    } finally {
      setSaving(false);
    }
  }, []);

  return { values, errors, formError, saving, set, submit, setFormError };
}

/** Texto digitado -> valor gravado: campos opcionais vazios viram null. */
export function nullIfEmpty(text: string): string | null {
  const trimmed = text.trim();
  return trimmed === '' ? null : trimmed;
}

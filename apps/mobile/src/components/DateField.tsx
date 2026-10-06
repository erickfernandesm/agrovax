import { formatDateBr, maskDateBr, parseDateBr } from '@agrovax/shared';
import { useEffect, useState } from 'react';
import { TextField } from './TextField';

interface DateFieldProps {
  label: string;
  /** Data em `AAAA-MM-DD`, ou null quando vazia ou incompleta. */
  value: string | null;
  onChange: (value: string | null) => void;
  error?: string;
  hint?: string;
}

/**
 * Campo de data digitada como DD/MM/AAAA, com teclado numerico e barras
 * automaticas. Informa o valor em formato ISO apenas quando a data existe.
 */
export function DateField({ label, value, onChange, error, hint }: DateFieldProps) {
  const [text, setText] = useState(formatDateBr(value));
  const [touched, setTouched] = useState(false);

  // Valor trocado por fora (ex.: carregar registro para edicao).
  useEffect(() => {
    if (value && parseDateBr(text) !== value) setText(formatDateBr(value));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const incomplete = touched && text !== '' && parseDateBr(text) === null;

  return (
    <TextField
      label={label}
      value={text}
      onChangeText={(input) => {
        const masked = maskDateBr(input);
        setText(masked);
        onChange(parseDateBr(masked));
      }}
      onBlur={() => setTouched(true)}
      placeholder="DD/MM/AAAA"
      keyboardType="number-pad"
      maxLength={10}
      error={error ?? (incomplete ? 'Data inválida. Use DD/MM/AAAA.' : undefined)}
      hint={hint}
    />
  );
}

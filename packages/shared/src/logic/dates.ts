/**
 * Datas "de calendario" (sem hora) no formato ISO `AAAA-MM-DD`.
 * Vacinacoes e tratamentos sao registrados por dia; trabalhar com texto evita
 * erros de fuso horario entre aparelho e servidor.
 */

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const BR_DATE = /^(\d{2})\/(\d{2})\/(\d{4})$/;
const DAY_MS = 24 * 60 * 60 * 1000;

function toUtcMs(year: number, month: number, day: number): number | null {
  const ms = Date.UTC(year, month - 1, day);
  const date = new Date(ms);
  const valid =
    date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
  return valid ? ms : null;
}

function isoToMs(iso: string): number | null {
  const match = ISO_DATE.exec(iso);
  if (!match) return null;
  return toUtcMs(Number(match[1]), Number(match[2]), Number(match[3]));
}

export function isValidIsoDate(value: string): boolean {
  return isoToMs(value) !== null;
}

/** Data de hoje no fuso do aparelho. */
export function todayIso(now: Date = new Date()): string {
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}

/** Dias de `from` ate `to` (negativo se `to` ja passou). */
export function daysBetween(from: string, to: string): number {
  const a = isoToMs(from);
  const b = isoToMs(to);
  if (a === null || b === null) return 0;
  return Math.round((b - a) / DAY_MS);
}

export function addDays(iso: string, days: number): string {
  const ms = isoToMs(iso);
  if (ms === null) return iso;
  return new Date(ms + days * DAY_MS).toISOString().slice(0, 10);
}

/** `2026-06-21` -> `21/06/2026`. Devolve texto vazio para valores nulos ou invalidos. */
export function formatDateBr(iso: string | null | undefined): string {
  if (!iso) return '';
  const match = ISO_DATE.exec(iso);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : '';
}

/** `21/06/2026` -> `2026-06-21`. Devolve null se a data nao existir. */
export function parseDateBr(text: string): string | null {
  const match = BR_DATE.exec(text.trim());
  if (!match) return null;
  const iso = `${match[3]}-${match[2]}-${match[1]}`;
  return isValidIsoDate(iso) ? iso : null;
}

/** Mascara de digitacao: `21062026` -> `21/06/2026`. */
export function maskDateBr(text: string): string {
  const digits = text.replace(/\D/g, '').slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

/**
 * Identidade visual do AgroVax.
 *
 * Verde de pasto como cor principal, neutros quentes (palha, terra clara) no
 * lugar do cinza frio tipico de painel web, e ocre como cor de destaque.
 * Os pares texto/fundo usados na interface tem contraste AA ou superior,
 * pensando em leitura sob sol forte.
 */
export const colors = {
  primary: '#1F6B3A',
  primaryDark: '#14482A',
  primarySoft: '#E3EFE6',
  onPrimary: '#FFFFFF',

  accent: '#B26A00',
  accentSoft: '#FBEFD9',

  background: '#F6F4EE',
  surface: '#FFFFFF',
  surfaceMuted: '#EFECE3',
  border: '#D9D4C5',

  text: '#1B2A20',
  textMuted: '#55635A',
  textOnDark: '#FFFFFF',

  danger: '#B3261E',
  dangerSoft: '#FBE9E7',
  warning: '#8A5300',
  warningSoft: '#FBEFD9',
  success: '#1F6B3A',
  successSoft: '#E3EFE6',
  info: '#1D5A80',
  infoSoft: '#E4EFF6',
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  pill: 999,
} as const;

/** Tamanhos generosos: o app e usado no campo, muitas vezes com uma mao so. */
export const typography = {
  title: { fontSize: 26, lineHeight: 32, fontWeight: '700' },
  heading: { fontSize: 20, lineHeight: 26, fontWeight: '700' },
  body: { fontSize: 17, lineHeight: 24, fontWeight: '400' },
  bodyStrong: { fontSize: 17, lineHeight: 24, fontWeight: '600' },
  label: { fontSize: 15, lineHeight: 20, fontWeight: '600' },
  caption: { fontSize: 14, lineHeight: 19, fontWeight: '400' },
} as const;

/** Altura minima de qualquer alvo de toque principal. */
export const touchTarget = 56;

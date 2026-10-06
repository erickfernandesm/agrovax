import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { VET_DISCLAIMER } from '@agrovax/shared';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing, typography } from '../theme/tokens';
import type { IconName } from './ListRow';

/** Pequenos elementos visuais usados em varias telas. */

/** Selo que identifica conteudo demonstrativo (ficticio). */
export function DemoBadge() {
  return (
    <View style={styles.demo} accessibilityLabel="Conteúdo de demonstração">
      <Text style={styles.demoText}>DEMO</Text>
    </View>
  );
}

type Tone = 'neutral' | 'success' | 'warning' | 'danger' | 'info';
const TONE_COLORS: Record<Tone, { foreground: string; background: string }> = {
  neutral: { foreground: colors.textMuted, background: colors.surfaceMuted },
  success: { foreground: colors.success, background: colors.successSoft },
  warning: { foreground: colors.warning, background: colors.warningSoft },
  danger: { foreground: colors.danger, background: colors.dangerSoft },
  info: { foreground: colors.info, background: colors.infoSoft },
};

export function Tag({ label, tone = 'neutral' }: { label: string; tone?: Tone }) {
  const palette = TONE_COLORS[tone];
  return (
    <View style={[styles.tag, { backgroundColor: palette.background }]}>
      <Text style={[styles.tagText, { color: palette.foreground }]}>{label}</Text>
    </View>
  );
}

export function SectionTitle({ children, right }: { children: string; right?: ReactNode }) {
  return (
    <View style={styles.sectionRow}>
      <Text style={styles.section}>{children}</Text>
      {right}
    </View>
  );
}

export function EmptyState({ icon, title, text }: { icon: IconName; title: string; text: string }) {
  return (
    <View style={styles.empty}>
      <View style={styles.emptyIcon}>
        <MaterialCommunityIcons name={icon} size={34} color={colors.primary} />
      </View>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyText}>{text}</Text>
    </View>
  );
}

/** Aviso de que o app nao substitui o medico-veterinario. */
export function Disclaimer() {
  return <Text style={styles.disclaimer}>{VET_DISCLAIMER}</Text>;
}

/** Linha "rotulo: valor" das fichas. Nao aparece quando o valor e vazio. */
export function Field({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Text style={styles.fieldValue}>{value}</Text>
    </View>
  );
}

interface StatCardProps {
  icon: IconName;
  label: string;
  value: number | string;
  tone?: Tone;
  onPress?: () => void;
}

/** Indicador do dashboard: numero grande, legivel de relance. */
export function StatCard({ icon, label, value, tone = 'neutral', onPress }: StatCardProps) {
  const palette = TONE_COLORS[tone === 'neutral' ? 'success' : tone];
  return (
    <Pressable
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : 'text'}
      accessibilityLabel={`${label}: ${value}`}
      onPress={onPress}
      style={({ pressed }) => [styles.stat, pressed && styles.statPressed]}
    >
      <View style={[styles.statIcon, { backgroundColor: palette.background }]}>
        <MaterialCommunityIcons name={icon} size={22} color={palette.foreground} />
      </View>
      <Text style={[styles.statValue, tone === 'danger' || tone === 'warning' ? { color: palette.foreground } : null]}>
        {value}
      </Text>
      <Text style={styles.statLabel}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  demo: {
    backgroundColor: colors.accent,
    borderRadius: radius.sm,
    paddingHorizontal: 8,
    paddingVertical: 2,
    alignSelf: 'flex-start',
  },
  demoText: { color: colors.onPrimary, fontSize: 12, fontWeight: '800', letterSpacing: 1 },
  tag: { borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 4, alignSelf: 'flex-start' },
  tagText: { fontSize: 13, fontWeight: '700' },
  sectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.sm,
  },
  section: { ...typography.heading, color: colors.text },
  empty: {
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.xl,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  emptyIcon: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: { ...typography.bodyStrong, color: colors.text, textAlign: 'center' },
  emptyText: { ...typography.body, color: colors.textMuted, textAlign: 'center' },
  disclaimer: { ...typography.caption, color: colors.textMuted },
  field: { gap: 2 },
  fieldLabel: { ...typography.caption, color: colors.textMuted, fontWeight: '700' },
  fieldValue: { ...typography.body, color: colors.text },
  stat: {
    flexBasis: '47%',
    flexGrow: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.xs,
  },
  statPressed: { backgroundColor: colors.surfaceMuted },
  statIcon: {
    width: 38,
    height: 38,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statValue: { fontSize: 30, lineHeight: 36, fontWeight: '800', color: colors.text },
  statLabel: { ...typography.caption, color: colors.textMuted, fontWeight: '600' },
});

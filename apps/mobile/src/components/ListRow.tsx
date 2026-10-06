import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing, touchTarget, typography } from '../theme/tokens';

export type IconName = keyof typeof MaterialCommunityIcons.glyphMap;

interface ListRowProps {
  icon: IconName;
  title: string;
  subtitle?: string | null;
  /** Conteudo a direita (ex.: selo, contagem). */
  right?: ReactNode;
  onPress?: () => void;
  tone?: 'default' | 'danger' | 'warning';
}

const TONES = {
  default: { foreground: colors.primary, background: colors.primarySoft },
  danger: { foreground: colors.danger, background: colors.dangerSoft },
  warning: { foreground: colors.warning, background: colors.warningSoft },
};

/** Linha de lista com alvo de toque grande. */
export function ListRow({ icon, title, subtitle, right, onPress, tone = 'default' }: ListRowProps) {
  const palette = TONES[tone];
  const content = (
    <>
      <View style={[styles.iconBox, { backgroundColor: palette.background }]}>
        <MaterialCommunityIcons name={icon} size={26} color={palette.foreground} />
      </View>
      <View style={styles.texts}>
        <Text style={styles.title}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
      {right}
      {onPress ? <MaterialCommunityIcons name="chevron-right" size={26} color={colors.textMuted} /> : null}
    </>
  );

  if (!onPress) return <View style={styles.row}>{content}</View>;
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: touchTarget + 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  pressed: { backgroundColor: colors.surfaceMuted },
  iconBox: {
    width: 46,
    height: 46,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  texts: { flex: 1 },
  title: { ...typography.bodyStrong, color: colors.text },
  subtitle: { ...typography.caption, color: colors.textMuted },
});

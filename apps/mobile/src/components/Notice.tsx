import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing, typography } from '../theme/tokens';

type Tone = 'error' | 'success' | 'info' | 'warning';

const TONES: Record<
  Tone,
  { background: string; foreground: string; icon: keyof typeof MaterialCommunityIcons.glyphMap }
> = {
  error: { background: colors.dangerSoft, foreground: colors.danger, icon: 'alert-circle' },
  success: { background: colors.successSoft, foreground: colors.success, icon: 'check-circle' },
  info: { background: colors.infoSoft, foreground: colors.info, icon: 'information' },
  warning: { background: colors.warningSoft, foreground: colors.warning, icon: 'alert' },
};

/** Mensagem destacada dentro da tela (erro de formulario, aviso, confirmacao). */
export function Notice({ tone, message }: { tone: Tone; message: string }) {
  const style = TONES[tone];
  return (
    <View
      style={[styles.container, { backgroundColor: style.background }]}
      accessibilityRole={tone === 'error' ? 'alert' : 'text'}
    >
      <MaterialCommunityIcons name={style.icon} size={22} color={style.foreground} />
      <Text style={[styles.text, { color: style.foreground }]}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
  },
  text: { ...typography.caption, flex: 1, fontWeight: '600' },
});

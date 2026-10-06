import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing, typography } from '../theme/tokens';

export interface ChipOption<T extends string> {
  value: T;
  label: string;
}

interface ChipSelectProps<T extends string> {
  label?: string;
  options: readonly ChipOption<T>[];
  value: T | null;
  onChange: (value: T | null) => void;
  /** Permite desmarcar (campo opcional). */
  optional?: boolean;
  error?: string;
}

/** Escolha unica por toque em "fichas" grandes, sem teclado e sem menu suspenso. */
export function ChipSelect<T extends string>({
  label,
  options,
  value,
  onChange,
  optional = false,
  error,
}: ChipSelectProps<T>) {
  return (
    <View style={styles.wrapper}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <View style={styles.row} accessibilityRole="radiogroup">
        {options.map((option) => {
          const selected = option.value === value;
          return (
            <Pressable
              key={option.value}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              onPress={() => onChange(selected && optional ? null : option.value)}
              style={({ pressed }) => [styles.chip, selected && styles.selected, pressed && styles.pressed]}
            >
              <Text style={[styles.text, selected && styles.selectedText]}>{option.label}</Text>
            </Pressable>
          );
        })}
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

/** Monta as opcoes a partir de uma lista de valores e de seus rotulos. */
export function optionsFrom<T extends string>(
  values: readonly T[],
  labels: Record<T, string>,
): ChipOption<T>[] {
  return values.map((value) => ({ value, label: labels[value] }));
}

const styles = StyleSheet.create({
  wrapper: { gap: spacing.sm },
  label: { ...typography.label, color: colors.text },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    minHeight: 46,
    paddingHorizontal: spacing.lg,
    justifyContent: 'center',
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  selected: { backgroundColor: colors.primary, borderColor: colors.primary },
  pressed: { opacity: 0.8 },
  text: { ...typography.label, color: colors.text },
  selectedText: { color: colors.onPrimary },
  error: { ...typography.caption, color: colors.danger },
});

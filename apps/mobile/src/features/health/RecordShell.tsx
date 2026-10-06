import { animalLabel, identifiedInLot, lotLabel } from '@agrovax/shared';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useMemo, type ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { NotFound } from '../../components/NotFound';
import { Screen } from '../../components/Screen';
import { useRecords } from '../../data/DataContext';
import type { HealthTarget } from '../../data/operations';
import { colors, radius, spacing, typography } from '../../theme/tokens';

export interface ResolvedTarget {
  target: HealthTarget;
  label: string;
  /** Animais identificados que tambem receberao o registro (somente lotes). */
  linkedAnimals: number;
}

/** Le da rota para qual animal ou lote o registro esta sendo feito. */
export function useHealthTarget(): ResolvedTarget | null {
  const { targetType, targetId } = useLocalSearchParams<{ targetType?: string; targetId?: string }>();
  const animals = useRecords('animal');
  const lots = useRecords('lot');

  return useMemo(() => {
    if (!targetId) return null;
    if (targetType === 'lot') {
      const lot = lots.find((item) => item.id === targetId);
      return lot
        ? {
            target: { type: 'lot', id: lot.id },
            label: lotLabel(lot),
            linkedAnimals: identifiedInLot(lot.id, animals).length,
          }
        : null;
    }
    const animal = animals.find((item) => item.id === targetId);
    return animal
      ? { target: { type: 'animal', id: animal.id }, label: animalLabel(animal), linkedAnimals: 0 }
      : null;
  }, [targetType, targetId, animals, lots]);
}

interface RecordShellProps {
  title: string;
  resolved: ResolvedTarget | null;
  children: ReactNode;
}

/** Moldura das telas de registro: titulo e identificacao clara do alvo. */
export function RecordShell({ title, resolved, children }: RecordShellProps) {
  if (!resolved) {
    return (
      <>
        <Stack.Screen options={{ title }} />
        <NotFound what="Animal ou lote" />
      </>
    );
  }
  return (
    <>
      <Stack.Screen options={{ title }} />
      <Screen edges={['left', 'right', 'bottom']}>
        <View style={styles.target}>
          <Text style={styles.targetCaption}>Registro para</Text>
          <Text style={styles.targetLabel}>{resolved.label}</Text>
          {resolved.linkedAnimals > 0 ? (
            <Text style={styles.targetHint}>
              Também entra no histórico dos {resolved.linkedAnimals} animais identificados do lote.
            </Text>
          ) : null}
        </View>
        {children}
      </Screen>
    </>
  );
}

const styles = StyleSheet.create({
  target: {
    backgroundColor: colors.primarySoft,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: 2,
  },
  targetCaption: { ...typography.caption, color: colors.primaryDark, fontWeight: '700' },
  targetLabel: { ...typography.heading, color: colors.primaryDark },
  targetHint: { ...typography.caption, color: colors.primaryDark },
});

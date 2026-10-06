import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { buildTimeline, type HealthAlert, type TimelineItem } from '@agrovax/shared';
import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SectionTitle } from '../../components/Bits';
import type { IconName } from '../../components/ListRow';
import { Notice } from '../../components/Notice';
import { useAlerts, useHerdRecords, useStore } from '../../data/DataContext';
import { removeHealthRecord, type HealthTarget } from '../../data/operations';
import { confirm } from '../../lib/confirm';
import { colors, radius, spacing, typography } from '../../theme/tokens';
import { Timeline } from './Timeline';

const ACTIONS: { route: 'vaccination' | 'treatment' | 'symptom' | 'event'; icon: IconName; label: string }[] = [
  { route: 'vaccination', icon: 'needle', label: 'Vacina' },
  { route: 'treatment', icon: 'pill', label: 'Tratamento' },
  { route: 'symptom', icon: 'thermometer', label: 'Sintoma' },
  { route: 'event', icon: 'clipboard-text', label: 'Evento' },
];

const ENTITY_OF = {
  vaccination: 'vaccination',
  treatment: 'treatment',
  symptom: 'symptomRecord',
  event: 'healthEvent',
} as const;

/**
 * Parte sanitaria da ficha de um animal ou de um lote: alertas, botoes de
 * registro e linha do tempo.
 */
export function HealthPanel({ target }: { target: HealthTarget }) {
  const router = useRouter();
  const store = useStore();
  const records = useHerdRecords();
  const { alerts } = useAlerts();

  const ownAlerts = alerts.filter(
    (alert: HealthAlert) => alert.targetType === target.type && alert.targetId === target.id,
  );
  const timeline = useMemo(() => buildTimeline(target, records), [target, records]);

  const remove = async (item: TimelineItem) => {
    const lotWide = target.type === 'lot' && (item.kind === 'vaccination' || item.kind === 'treatment');
    const accepted = await confirm(
      'Excluir registro',
      lotWide
        ? `Excluir "${item.title}" do lote e dos animais vinculados?`
        : `Excluir "${item.title}"?`,
    );
    if (accepted) await removeHealthRecord(store, ENTITY_OF[item.kind], item.id);
  };

  return (
    <View style={styles.wrapper}>
      {ownAlerts.map((alert) => (
        <Notice key={alert.key} tone={alert.daysUntil < 0 ? 'error' : 'warning'} message={alert.message} />
      ))}

      <SectionTitle>Registrar</SectionTitle>
      <View style={styles.actions}>
        {ACTIONS.map((action) => (
          <Pressable
            key={action.route}
            accessibilityRole="button"
            accessibilityLabel={`Registrar ${action.label.toLowerCase()}`}
            onPress={() =>
              router.push({
                pathname: `/records/${action.route}`,
                params: { targetType: target.type, targetId: target.id },
              })
            }
            style={({ pressed }) => [styles.action, pressed && styles.pressed]}
          >
            <MaterialCommunityIcons name={action.icon} size={28} color={colors.primary} />
            <Text style={styles.actionLabel}>{action.label}</Text>
          </Pressable>
        ))}
      </View>

      <SectionTitle>Linha do tempo</SectionTitle>
      <Timeline items={timeline} onRemove={(item) => void remove(item)} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { gap: spacing.lg },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  action: {
    flexBasis: '47%',
    flexGrow: 1,
    minHeight: 76,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderColor: colors.primary,
  },
  pressed: { backgroundColor: colors.primarySoft },
  actionLabel: { ...typography.label, color: colors.primaryDark },
});

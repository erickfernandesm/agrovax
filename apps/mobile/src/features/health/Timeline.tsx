import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { formatDateBr, type TimelineItem, type TimelineKind } from '@agrovax/shared';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { EmptyState, Tag } from '../../components/Bits';
import type { IconName } from '../../components/ListRow';
import { colors, spacing, typography } from '../../theme/tokens';

const LOOK: Record<TimelineKind, { icon: IconName; color: string; background: string }> = {
  vaccination: { icon: 'needle', color: colors.primary, background: colors.primarySoft },
  treatment: { icon: 'pill', color: colors.info, background: colors.infoSoft },
  symptom: { icon: 'thermometer', color: colors.warning, background: colors.warningSoft },
  event: { icon: 'clipboard-text', color: colors.textMuted, background: colors.surfaceMuted },
};

interface TimelineProps {
  items: TimelineItem[];
  onRemove: (item: TimelineItem) => void;
}

/** Linha do tempo sanitaria: eventos do mais recente para o mais antigo. */
export function Timeline({ items, onRemove }: TimelineProps) {
  if (items.length === 0) {
    return (
      <EmptyState
        icon="timeline-clock-outline"
        title="Nenhum registro ainda"
        text="Vacinas, tratamentos, sintomas e eventos aparecem aqui em ordem de data."
      />
    );
  }

  return (
    <View>
      {items.map((item, index) => {
        const look = LOOK[item.kind];
        const last = index === items.length - 1;
        return (
          <View key={`${item.kind}-${item.id}`} style={styles.row}>
            <View style={styles.rail}>
              <View style={[styles.dot, { backgroundColor: look.background }]}>
                <MaterialCommunityIcons name={look.icon} size={20} color={look.color} />
              </View>
              {last ? null : <View style={styles.line} />}
            </View>

            <View style={styles.body}>
              <Text style={styles.date}>{formatDateBr(item.date)}</Text>
              <Text style={styles.title}>{item.title}</Text>
              {item.subtitle ? <Text style={styles.detail}>{item.subtitle}</Text> : null}
              {item.nextDate ? (
                <Text style={styles.detail}>Próxima: {formatDateBr(item.nextDate)}</Text>
              ) : null}
              {item.responsible ? <Text style={styles.detail}>Responsável: {item.responsible}</Text> : null}
              {item.notes ? <Text style={styles.detail}>{item.notes}</Text> : null}
              <View style={styles.footer}>
                {item.fromLot ? <Tag label="Aplicado no lote" tone="info" /> : <View />}
                {item.fromLot ? null : (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Excluir ${item.title}`}
                    hitSlop={12}
                    onPress={() => onRemove(item)}
                  >
                    <Text style={styles.remove}>Excluir</Text>
                  </Pressable>
                )}
              </View>
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: spacing.md },
  rail: { alignItems: 'center', width: 40 },
  dot: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  line: { flex: 1, width: 2, backgroundColor: colors.border, marginVertical: 2 },
  body: { flex: 1, paddingBottom: spacing.xl, gap: 2 },
  date: { ...typography.caption, color: colors.textMuted, fontWeight: '700' },
  title: { ...typography.bodyStrong, color: colors.text },
  detail: { ...typography.caption, color: colors.textMuted },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.xs,
  },
  remove: { ...typography.caption, color: colors.danger, fontWeight: '700' },
});

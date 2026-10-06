import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { SYNC_STATE_LABEL, type SyncState } from '@agrovax/shared';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text } from 'react-native';
import { useSyncStatus } from '../data/DataContext';
import { colors, radius, spacing, typography } from '../theme/tokens';

const LOOK: Record<
  SyncState,
  { icon: keyof typeof MaterialCommunityIcons.glyphMap; foreground: string; background: string }
> = {
  SYNCED: { icon: 'cloud-check', foreground: colors.success, background: colors.successSoft },
  SYNCING: { icon: 'cloud-sync', foreground: colors.info, background: colors.infoSoft },
  OFFLINE: { icon: 'cloud-off-outline', foreground: colors.warning, background: colors.warningSoft },
  ERROR: { icon: 'cloud-alert', foreground: colors.danger, background: colors.dangerSoft },
};

/** Estado da sincronizacao, sempre visivel. Tocar abre os detalhes. */
export function SyncBadge() {
  const status = useSyncStatus();
  const router = useRouter();
  const look = LOOK[status.state];
  const waiting = status.pending > 0 && status.state !== 'SYNCING' ? ` · ${status.pending}` : '';

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Sincronização: ${SYNC_STATE_LABEL[status.state]}. Toque para ver detalhes.`}
      onPress={() => router.push('/sync')}
      style={({ pressed }) => [styles.badge, { backgroundColor: look.background }, pressed && styles.pressed]}
    >
      <MaterialCommunityIcons name={look.icon} size={18} color={look.foreground} />
      <Text style={[styles.text, { color: look.foreground }]}>
        {SYNC_STATE_LABEL[status.state]}
        {waiting}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    minHeight: 36,
    borderRadius: radius.pill,
  },
  pressed: { opacity: 0.75 },
  text: { ...typography.caption, fontWeight: '700' },
});

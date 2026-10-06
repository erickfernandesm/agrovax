import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { formatDateBr, type HealthAlert } from '@agrovax/shared';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Disclaimer, EmptyState, SectionTitle, Tag } from '../../../components/Bits';
import { Button } from '../../../components/Button';
import { Notice } from '../../../components/Notice';
import { Screen } from '../../../components/Screen';
import { SyncBadge } from '../../../components/SyncBadge';
import { useAlerts } from '../../../data/DataContext';
import {
  getNotificationPermission,
  notificationsSupported,
  requestNotificationPermission,
  type NotificationPermission,
} from '../../../services/notifications';
import { colors, radius, spacing, typography } from '../../../theme/tokens';

function dueTag(alert: HealthAlert) {
  if (alert.daysUntil < 0) return <Tag label="Vencido" tone="danger" />;
  if (alert.daysUntil === 0) return <Tag label="Vence hoje" tone="danger" />;
  return <Tag label={`Em ${alert.daysUntil} ${alert.daysUntil === 1 ? 'dia' : 'dias'}`} tone="warning" />;
}

function AlertCard({
  alert,
  actionLabel,
  onAction,
}: {
  alert: HealthAlert;
  actionLabel: string;
  onAction: () => void;
}) {
  const router = useRouter();
  const overdue = alert.daysUntil < 0;
  const open = () =>
    alert.targetType === 'lot'
      ? router.push({ pathname: '/lots/[id]', params: { id: alert.targetId } })
      : router.push({ pathname: '/animals/[id]', params: { id: alert.targetId } });

  return (
    <View style={[styles.card, overdue && styles.cardOverdue]}>
      <Pressable accessibilityRole="button" onPress={open} style={styles.cardBody}>
        <MaterialCommunityIcons
          name={alert.sourceType === 'vaccination' ? 'needle' : 'pill'}
          size={26}
          color={overdue ? colors.danger : colors.warning}
        />
        <View style={styles.cardTexts}>
          <View style={styles.cardTop}>
            <Text style={styles.cardTitle}>{alert.title}</Text>
            {dueTag(alert)}
          </View>
          <Text style={styles.cardMessage}>{alert.message}</Text>
          <Text style={styles.cardDate}>Data prevista: {formatDateBr(alert.dueDate)}</Text>
        </View>
      </Pressable>
      <Pressable accessibilityRole="button" onPress={onAction} hitSlop={8} style={styles.cardAction}>
        <Text style={styles.cardActionText}>{actionLabel}</Text>
      </Pressable>
    </View>
  );
}

export default function AlertsScreen() {
  const { alerts, dismissed, dismiss, restore } = useAlerts();
  const [permission, setPermission] = useState<NotificationPermission | null>(null);

  useEffect(() => {
    if (notificationsSupported) void getNotificationPermission().then(setPermission);
  }, []);

  return (
    <Screen>
      <View style={styles.titleRow}>
        <Text style={styles.title}>Alertas</Text>
        <SyncBadge />
      </View>

      {notificationsSupported && permission === 'undetermined' ? (
        <View style={styles.permission}>
          <Text style={styles.permissionText}>
            Receba um aviso no celular 30, 15 e 7 dias antes de cada vacina ou tratamento, mesmo sem internet.
          </Text>
          <Button
            label="Ativar notificações"
            onPress={() => void requestNotificationPermission().then(setPermission)}
          />
        </View>
      ) : null}
      {notificationsSupported && permission === 'denied' ? (
        <Notice
          tone="info"
          message="As notificações estão desativadas para o AgroVax. Para receber avisos, ative-as nas configurações do aparelho. Os alertas continuam aparecendo aqui."
        />
      ) : null}

      {alerts.length === 0 ? (
        <EmptyState
          icon="bell-check"
          title="Nenhum alerta no momento"
          text="Os alertas aparecem 30, 15 e 7 dias antes da próxima dose ou aplicação, e quando a data passa."
        />
      ) : (
        alerts.map((alert) => (
          <AlertCard
            key={alert.key}
            alert={alert}
            actionLabel="Dispensar"
            onAction={() => void dismiss(alert.key)}
          />
        ))
      )}

      {dismissed.length > 0 ? (
        <>
          <SectionTitle>Dispensados</SectionTitle>
          {dismissed.map((alert) => (
            <AlertCard
              key={alert.key}
              alert={alert}
              actionLabel="Restaurar"
              onAction={() => void restore(alert.key)}
            />
          ))}
        </>
      ) : null}

      <Disclaimer />
    </Screen>
  );
}

const styles = StyleSheet.create({
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { ...typography.title, color: colors.text },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    borderLeftWidth: 5,
    borderLeftColor: colors.warning,
  },
  cardOverdue: { borderLeftColor: colors.danger },
  cardBody: { flexDirection: 'row', gap: spacing.md, padding: spacing.lg },
  cardTexts: { flex: 1, gap: spacing.xs },
  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  cardTitle: { ...typography.bodyStrong, color: colors.text, flexShrink: 1 },
  cardMessage: { ...typography.body, color: colors.text },
  cardDate: { ...typography.caption, color: colors.textMuted },
  cardAction: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardActionText: { ...typography.label, color: colors.primary },
  permission: {
    backgroundColor: colors.primarySoft,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.md,
  },
  permissionText: { ...typography.body, color: colors.primaryDark },
});

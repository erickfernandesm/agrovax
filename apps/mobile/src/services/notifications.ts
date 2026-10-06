import type { PlannedNotification } from '@agrovax/shared';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

/**
 * Notificacoes LOCAIS de vacinas e tratamentos. Sao agendadas no proprio
 * aparelho e, por isso, disparam sem internet e sem custo de servico.
 *
 * Preparado para push: basta registrar o token do aparelho neste modulo e
 * envia-lo a API; o restante do app nao depende de como a notificacao chega.
 */

const CHANNEL_ID = 'alertas-sanitarios';
/** Horario do aviso no dia programado. */
const NOTIFY_HOUR = 7;

let configured = false;

async function configure(): Promise<void> {
  if (configured) return;
  configured = true;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldPlaySound: true,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
      name: 'Alertas sanitários',
      importance: Notifications.AndroidImportance.HIGH,
    });
  }
}

export type NotificationPermission = 'granted' | 'denied' | 'undetermined';

export async function getNotificationPermission(): Promise<NotificationPermission> {
  const { status } = await Notifications.getPermissionsAsync();
  return status;
}

export async function requestNotificationPermission(): Promise<NotificationPermission> {
  const { status } = await Notifications.requestPermissionsAsync();
  return status;
}

/**
 * Substitui todas as notificacoes agendadas pelas planejadas.
 * Devolve quantas foram agendadas (0 se nao houver permissao).
 */
export async function scheduleNotifications(planned: readonly PlannedNotification[]): Promise<number> {
  await configure();
  if ((await getNotificationPermission()) !== 'granted') return 0;

  await Notifications.cancelAllScheduledNotificationsAsync();
  let scheduled = 0;
  for (const item of planned) {
    const [year, month, day] = item.date.split('-').map(Number);
    if (!year || !month || !day) continue;
    const date = new Date(year, month - 1, day, NOTIFY_HOUR, 0, 0);
    if (date.getTime() <= Date.now()) continue;

    await Notifications.scheduleNotificationAsync({
      identifier: item.id,
      content: { title: item.title, body: item.body },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date, channelId: CHANNEL_ID },
    });
    scheduled += 1;
  }
  return scheduled;
}

export const notificationsSupported = true;

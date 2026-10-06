import type { PlannedNotification } from '@agrovax/shared';

/**
 * Pre-visualizacao WEB: o modulo de notificacoes do Expo nao funciona no
 * navegador. A central de alertas dentro do app continua valendo.
 */
export type NotificationPermission = 'granted' | 'denied' | 'undetermined';

export async function getNotificationPermission(): Promise<NotificationPermission> {
  return 'denied';
}

export async function requestNotificationPermission(): Promise<NotificationPermission> {
  return 'denied';
}

export async function scheduleNotifications(_planned: readonly PlannedNotification[]): Promise<number> {
  return 0;
}

export const notificationsSupported = false;

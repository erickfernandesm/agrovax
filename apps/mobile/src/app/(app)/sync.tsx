import { SYNC_STATE_LABEL, type EntityName } from '@agrovax/shared';
import { Stack } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Field, SectionTitle } from '../../components/Bits';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { Notice } from '../../components/Notice';
import { Screen } from '../../components/Screen';
import { useStore, useSyncEngine, useSyncStatus } from '../../data/DataContext';
import type { OutboxOp } from '../../data/store/LocalStore';
import { confirm } from '../../lib/confirm';
import { colors, radius, spacing, typography } from '../../theme/tokens';

const ENTITY_LABEL: Record<EntityName, string> = {
  animal: 'Animal',
  lot: 'Lote',
  vaccination: 'Vacinação',
  treatment: 'Tratamento',
  symptomRecord: 'Sintoma',
  healthEvent: 'Evento',
};

function describeOp(op: OutboxOp): string {
  const what = ENTITY_LABEL[op.entity];
  const name = op.changes.tag ?? op.changes.name ?? op.changes.vaccineName ?? op.changes.product ?? op.changes.title;
  const action = op.action === 'DELETE' ? 'exclusão' : op.baseVersion === 0 ? 'cadastro' : 'alteração';
  return typeof name === 'string' ? `${what} "${name}" (${action})` : `${what} (${action})`;
}

function formatMoment(iso: string | null): string {
  if (!iso) return 'Ainda não sincronizado neste aparelho';
  return new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
}

export default function SyncScreen() {
  const store = useStore();
  const engine = useSyncEngine();
  const status = useSyncStatus();
  const [busy, setBusy] = useState(false);

  const syncNow = async () => {
    setBusy(true);
    await engine.sync();
    setBusy(false);
  };

  const retry = async (opId: string) => {
    await store.retryFailed(opId);
    await engine.sync();
  };

  const discard = async (op: OutboxOp) => {
    const accepted = await confirm(
      'Descartar alteração',
      `Descartar ${describeOp(op)}? A alteração feita neste aparelho será perdida.`,
      'Descartar',
    );
    if (!accepted) return;
    await store.discardFailed(op.opId);
    await engine.sync();
  };

  const tone =
    status.state === 'SYNCED' ? 'success' : status.state === 'ERROR' ? 'error' : status.state === 'OFFLINE' ? 'warning' : 'info';
  const explanation: Record<typeof status.state, string> = {
    SYNCED: 'Tudo o que você registrou neste aparelho já está guardado no servidor.',
    SYNCING: 'Enviando e recebendo dados...',
    OFFLINE: 'Sem internet. Você pode continuar trabalhando: os registros ficam guardados no aparelho e são enviados quando a conexão voltar.',
    ERROR: status.message ?? 'Houve um problema na sincronização.',
  };

  return (
    <>
      <Stack.Screen options={{ title: 'Sincronização' }} />
      <Screen edges={['left', 'right', 'bottom']}>
        <Notice tone={tone} message={`${SYNC_STATE_LABEL[status.state]}. ${explanation[status.state]}`} />

        <Card>
          <Field label="Última sincronização" value={formatMoment(status.lastSyncAt)} />
          <Field label="Alterações aguardando envio" value={String(status.pending)} />
          <Field label="Alterações recusadas pelo servidor" value={String(status.failed)} />
        </Card>

        <Button
          label="Sincronizar agora"
          loading={busy || status.state === 'SYNCING'}
          disabled={status.state === 'OFFLINE'}
          onPress={() => void syncNow()}
        />

        {store.failedOps.length > 0 ? (
          <>
            <SectionTitle>Alterações recusadas</SectionTitle>
            <Text style={styles.hint}>
              Estes dados continuam guardados no aparelho. Corrija o registro e tente de novo, ou descarte a alteração.
            </Text>
            {store.failedOps.map((op) => (
              <View key={op.opId} style={styles.failed}>
                <Text style={styles.failedTitle}>{describeOp(op)}</Text>
                <Text style={styles.failedReason}>{op.error?.message}</Text>
                <View style={styles.failedActions}>
                  <View style={styles.flex}>
                    <Button label="Tentar de novo" variant="secondary" onPress={() => void retry(op.opId)} />
                  </View>
                  <View style={styles.flex}>
                    <Button label="Descartar" variant="danger" onPress={() => void discard(op)} />
                  </View>
                </View>
              </View>
            ))}
          </>
        ) : null}

        {store.notices.length > 0 ? (
          <>
            <SectionTitle>Avisos</SectionTitle>
            {store.notices.map((notice) => (
              <Notice key={notice.id} tone="info" message={`${formatMoment(notice.at)}: ${notice.message}`} />
            ))}
            <Button label="Limpar avisos" variant="ghost" onPress={() => void store.clearNotices()} />
          </>
        ) : null}
      </Screen>
    </>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  hint: { ...typography.caption, color: colors.textMuted },
  failed: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.danger,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  failedTitle: { ...typography.bodyStrong, color: colors.text },
  failedReason: { ...typography.body, color: colors.danger },
  failedActions: { flexDirection: 'row', gap: spacing.sm },
});

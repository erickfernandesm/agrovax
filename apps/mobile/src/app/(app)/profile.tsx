import {
  BR_STATES,
  formatDateBr,
  MEMBER_ROLE_LABEL,
  PLAN_LABEL,
  planUsage,
  updateFarmSchema,
  type BrState,
  type SubscriptionStatus,
} from '@agrovax/shared';
import { Stack } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Disclaimer, Field, Tag } from '../../components/Bits';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { Notice } from '../../components/Notice';
import { Screen } from '../../components/Screen';
import { TextField } from '../../components/TextField';
import { useRecords, useSyncStatus } from '../../data/DataContext';
import { useAuth } from '../../features/auth/AuthContext';
import { useConnectivity } from '../../hooks/useConnectivity';
import { confirm } from '../../lib/confirm';
import { colors, typography } from '../../theme/tokens';

const STATUS_LABEL: Record<SubscriptionStatus, string> = {
  ACTIVE: 'Ativa',
  TRIALING: 'Em período de teste',
  PAST_DUE: 'Pagamento pendente',
  CANCELED: 'Cancelada',
  EXPIRED: 'Vencida',
};

function isBrState(value: string): value is BrState {
  return (BR_STATES as readonly string[]).includes(value);
}

const limitText = (used: number, limit: number | null) =>
  limit === null ? `${used} (sem limite)` : `${used} de ${limit}`;

export default function ProfileScreen() {
  const { user, activeFarm, signOut, updateActiveFarm } = useAuth();
  const { isOnline } = useConnectivity();
  const sync = useSyncStatus();
  const animals = useRecords('animal');
  const lots = useRecords('lot');

  const [name, setName] = useState(activeFarm?.name ?? '');
  const [city, setCity] = useState(activeFarm?.city ?? '');
  const [state, setState] = useState(activeFarm?.state ?? '');
  const [errors, setErrors] = useState<{ name?: string; state?: string }>({});
  const [feedback, setFeedback] = useState<{ tone: 'success' | 'error'; message: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [leaving, setLeaving] = useState(false);

  const canEdit = activeFarm?.role === 'OWNER' || activeFarm?.role === 'MANAGER';
  const subscription = activeFarm?.subscription;
  const usage = subscription ? planUsage({ animals, lots }, subscription.limits) : null;

  const save = async () => {
    setFeedback(null);
    const uf = state.trim().toUpperCase();
    if (uf !== '' && !isBrState(uf)) {
      setErrors({ state: 'Informe a sigla do estado (ex.: MG).' });
      return;
    }
    const parsed = updateFarmSchema.safeParse({
      name,
      city: city.trim() === '' ? null : city,
      state: uf === '' ? null : uf,
    });
    if (!parsed.success) {
      setErrors({ name: parsed.error.issues.find((i) => i.path[0] === 'name')?.message });
      return;
    }

    setErrors({});
    setSaving(true);
    try {
      await updateActiveFarm(parsed.data);
      setFeedback({ tone: 'success', message: 'Dados da fazenda salvos.' });
    } catch (error) {
      setFeedback({
        tone: 'error',
        message: error instanceof Error ? error.message : 'Não foi possível salvar.',
      });
    } finally {
      setSaving(false);
    }
  };

  const leave = async () => {
    const waiting = sync.pending + sync.failed;
    if (waiting > 0) {
      const accepted = await confirm(
        'Há dados não sincronizados',
        `${waiting} ${waiting === 1 ? 'alteração ainda não foi enviada' : 'alterações ainda não foram enviadas'} ao servidor. Elas continuam guardadas neste aparelho e serão enviadas quando você entrar de novo com internet. Sair mesmo assim?`,
        'Sair',
      );
      if (!accepted) return;
    }
    setLeaving(true);
    await signOut();
  };

  return (
    <>
      <Stack.Screen options={{ title: 'Perfil e fazenda' }} />
      <Screen edges={['left', 'right', 'bottom']}>
        <Card>
          <Text style={styles.label}>Sua conta</Text>
          <Text style={styles.value}>{user?.name}</Text>
          <Text style={styles.muted}>{user?.email}</Text>
          {activeFarm ? <Text style={styles.muted}>{MEMBER_ROLE_LABEL[activeFarm.role]} da fazenda</Text> : null}
        </Card>

        {subscription && usage ? (
          <Card>
            <Text style={styles.label}>Plano</Text>
            <View style={styles.planRow}>
              <Text style={styles.value}>{PLAN_LABEL[subscription.plan]}</Text>
              <Tag
                label={STATUS_LABEL[subscription.status]}
                tone={subscription.status === 'ACTIVE' || subscription.status === 'TRIALING' ? 'success' : 'danger'}
              />
            </View>
            {subscription.expiresAt ? (
              <Field label="Válido até" value={formatDateBr(subscription.expiresAt.slice(0, 10))} />
            ) : null}
            <Field
              label="Animais cadastrados individualmente"
              value={limitText(usage.animals.used, usage.animals.limit)}
            />
            <Field label="Lotes" value={limitText(usage.lots.used, usage.lots.limit)} />
            {usage.animals.reached || usage.lots.reached ? (
              <Notice tone="warning" message="Você atingiu um limite do seu plano." />
            ) : null}
            <Text style={styles.hint}>
              A contratação de planos pagos pelo aplicativo ainda não está disponível. Para mudar de plano, fale com o
              suporte do AgroVax.
            </Text>
          </Card>
        ) : null}

        {activeFarm ? (
          <Card>
            <Text style={styles.label}>Fazenda</Text>
            {feedback ? <Notice tone={feedback.tone} message={feedback.message} /> : null}
            {!isOnline ? (
              <Notice tone="warning" message="Sem internet. Os dados da fazenda só podem ser alterados com conexão." />
            ) : null}

            <TextField
              label="Nome da fazenda"
              value={name}
              onChangeText={setName}
              error={errors.name}
              editable={canEdit}
              autoCapitalize="words"
            />
            <TextField label="Cidade" value={city} onChangeText={setCity} editable={canEdit} autoCapitalize="words" />
            <TextField
              label="Estado (UF)"
              value={state}
              onChangeText={(value) => setState(value.toUpperCase().slice(0, 2))}
              error={errors.state}
              hint="Usado para destacar os alertas de vigilância da sua região."
              editable={canEdit}
              autoCapitalize="characters"
              maxLength={2}
            />
            {canEdit ? (
              <Button label="Salvar fazenda" loading={saving} disabled={!isOnline} onPress={() => void save()} />
            ) : (
              <Text style={styles.muted}>Somente proprietário ou gerente altera estes dados.</Text>
            )}
          </Card>
        ) : null}

        <Button label="Sair da conta" variant="danger" loading={leaving} onPress={() => void leave()} />
        <Disclaimer />
      </Screen>
    </>
  );
}

const styles = StyleSheet.create({
  label: { ...typography.caption, color: colors.textMuted, fontWeight: '700' },
  value: { ...typography.heading, color: colors.text },
  muted: { ...typography.body, color: colors.textMuted },
  hint: { ...typography.caption, color: colors.textMuted },
  planRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
});

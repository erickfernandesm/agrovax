import {
  animalLabel,
  computeDashboard,
  formatDateBr,
  lotLabel,
  type DashboardView,
  type VaccinationRecord,
} from '@agrovax/shared';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Disclaimer, EmptyState, SectionTitle, StatCard } from '../../../components/Bits';
import { ChipSelect } from '../../../components/ChipSelect';
import { ListRow } from '../../../components/ListRow';
import { Logo } from '../../../components/Logo';
import { Notice } from '../../../components/Notice';
import { Screen } from '../../../components/Screen';
import { SyncBadge } from '../../../components/SyncBadge';
import { useAlerts, useCatalog, useHerdRecords } from '../../../data/DataContext';
import { useAuth } from '../../../features/auth/AuthContext';
import { colors, spacing, typography } from '../../../theme/tokens';

const VIEWS: { value: DashboardView; label: string }[] = [
  { value: 'HERD', label: 'Visão por rebanho' },
  { value: 'INDIVIDUAL', label: 'Visão individual' },
];

export default function HomeScreen() {
  const router = useRouter();
  const { user, activeFarm } = useAuth();
  const records = useHerdRecords();
  const { alerts } = useAlerts();
  const catalog = useCatalog();
  const [view, setView] = useState<DashboardView>('HERD');

  const stats = useMemo(() => computeDashboard(records, alerts, view), [records, alerts, view]);

  // Alertas de vigilancia do estado da fazenda ou sem estado definido (nacionais).
  const outbreaks = (catalog?.surveillanceAlerts ?? []).filter(
    (alert) => !alert.state || !activeFarm?.state || alert.state === activeFarm.state,
  );
  const targetType = view === 'INDIVIDUAL' ? 'animal' : 'lot';
  const viewAlerts = alerts.filter((alert) => alert.targetType === targetType);

  const describeTarget = (vaccination: VaccinationRecord): string => {
    if (vaccination.lotId) {
      const lot = records.lots.find((item) => item.id === vaccination.lotId);
      return lot ? lotLabel(lot) : 'Lote';
    }
    const animal = records.animals.find((item) => item.id === vaccination.animalId);
    return animal ? animalLabel(animal) : 'Animal';
  };

  const empty = records.animals.length === 0 && records.lots.length === 0;

  return (
    <Screen>
      <View style={styles.topBar}>
        <Logo size="small" />
        <SyncBadge />
      </View>

      <View>
        <Text style={styles.greeting}>Olá, {user?.name.split(' ')[0]}</Text>
        <Text style={styles.farm}>{activeFarm?.name}</Text>
      </View>

      <ChipSelect options={VIEWS} value={view} onChange={(next) => next && setView(next)} />

      {empty ? (
        <EmptyState
          icon="barn"
          title="Comece cadastrando seu rebanho"
          text="Use a aba Rebanhos para criar um lote ou a aba Animais para cadastrar um animal individual."
        />
      ) : null}

      <View style={styles.grid}>
        <StatCard
          icon={view === 'HERD' ? 'fence' : 'cow'}
          label={view === 'HERD' ? `Animais em ${stats.lotCount} lote(s)` : 'Animais individuais'}
          value={stats.viewTotal.toLocaleString('pt-BR')}
          onPress={() => router.push(view === 'HERD' ? '/herds' : '/animals')}
        />
        <StatCard icon="sigma" label="Total de animais da fazenda" value={stats.totalAnimals.toLocaleString('pt-BR')} />
        <StatCard
          icon="needle"
          label="Vacinas pendentes"
          value={stats.pendingVaccinations}
          tone={stats.pendingVaccinations > 0 ? 'warning' : 'neutral'}
          onPress={() => router.push('/alerts')}
        />
        <StatCard
          icon="pill"
          label="Tratamentos pendentes"
          value={stats.pendingTreatments}
          tone={stats.pendingTreatments > 0 ? 'warning' : 'neutral'}
          onPress={() => router.push('/alerts')}
        />
        <StatCard
          icon="bell-alert"
          label="Alertas sanitários"
          value={viewAlerts.length}
          tone={stats.overdue > 0 ? 'danger' : viewAlerts.length > 0 ? 'warning' : 'neutral'}
          onPress={() => router.push('/alerts')}
        />
        <StatCard
          icon="shield-alert"
          label="Surtos na região"
          value={outbreaks.length}
          tone={outbreaks.length > 0 ? 'warning' : 'neutral'}
          onPress={() => router.push('/surveillance')}
        />
      </View>

      {stats.overdue > 0 ? (
        <Notice
          tone="error"
          message={`${stats.overdue} ${stats.overdue === 1 ? 'item está atrasado' : 'itens estão atrasados'}. Veja a aba Alertas.`}
        />
      ) : null}

      <SectionTitle>Últimas vacinações</SectionTitle>
      {stats.recentVaccinations.length === 0 ? (
        <Text style={styles.muted}>Nenhuma vacinação registrada nesta visão.</Text>
      ) : (
        stats.recentVaccinations.map((vaccination) => (
          <ListRow
            key={vaccination.id}
            icon="needle"
            title={vaccination.vaccineName}
            subtitle={`${describeTarget(vaccination)} · ${formatDateBr(vaccination.appliedAt)}`}
            onPress={() =>
              vaccination.lotId
                ? router.push({ pathname: '/lots/[id]', params: { id: vaccination.lotId } })
                : vaccination.animalId
                  ? router.push({ pathname: '/animals/[id]', params: { id: vaccination.animalId } })
                  : undefined
            }
          />
        ))
      )}

      <Disclaimer />
    </Screen>
  );
}

const styles = StyleSheet.create({
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  greeting: { ...typography.title, color: colors.text },
  farm: { ...typography.body, color: colors.textMuted },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  muted: { ...typography.body, color: colors.textMuted },
});

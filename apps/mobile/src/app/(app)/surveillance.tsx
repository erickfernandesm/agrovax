import {
  formatDateBr,
  RISK_LEVEL_LABEL,
  type RiskLevel,
  type SurveillanceAlertDto,
} from '@agrovax/shared';
import { Stack } from 'expo-router';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { DemoBadge, Disclaimer, EmptyState, SectionTitle, Tag } from '../../components/Bits';
import { Notice } from '../../components/Notice';
import { Screen } from '../../components/Screen';
import { useCatalog } from '../../data/DataContext';
import { useAuth } from '../../features/auth/AuthContext';
import { colors, radius, spacing, typography } from '../../theme/tokens';

const RISK_TONE: Record<RiskLevel, 'success' | 'warning' | 'danger'> = {
  LOW: 'success',
  MEDIUM: 'warning',
  HIGH: 'danger',
};

function AlertCard({ alert }: { alert: SurveillanceAlertDto }) {
  return (
    <View style={styles.card}>
      <View style={styles.cardTop}>
        <Text style={styles.disease}>{alert.diseaseName}</Text>
        {alert.isDemo ? <DemoBadge /> : null}
      </View>
      <View style={styles.tags}>
        <Tag label={`Risco ${RISK_LEVEL_LABEL[alert.riskLevel].toLowerCase()}`} tone={RISK_TONE[alert.riskLevel]} />
        <Tag label={alert.region} />
        <Tag label={formatDateBr(alert.reportedAt)} />
      </View>
      {alert.isDemo ? (
        <Text style={styles.demoNote}>Dado fictício de demonstração. Não é um alerta sanitário real.</Text>
      ) : null}
      <Text style={styles.label}>Descrição</Text>
      <Text style={styles.text}>{alert.description}</Text>
      <Text style={styles.label}>Orientação preventiva</Text>
      <Text style={styles.text}>{alert.guidance}</Text>
      <Text style={styles.label}>Fonte</Text>
      {alert.sourceUrl ? (
        <Pressable accessibilityRole="link" onPress={() => void Linking.openURL(alert.sourceUrl as string)}>
          <Text style={styles.link}>{alert.sourceName}</Text>
        </Pressable>
      ) : (
        <Text style={styles.text}>{alert.sourceName}</Text>
      )}
    </View>
  );
}

export default function SurveillanceScreen() {
  const catalog = useCatalog();
  const { activeFarm } = useAuth();
  const all = catalog?.surveillanceAlerts ?? [];
  const state = activeFarm?.state ?? null;

  // Alertas do estado da fazenda (ou sem estado definido) primeiro.
  const nearby = all.filter((alert) => !alert.state || !state || alert.state === state);
  const elsewhere = all.filter((alert) => !nearby.includes(alert));
  const onlyDemo = all.length > 0 && all.every((alert) => alert.isDemo);

  return (
    <>
      <Stack.Screen options={{ title: 'Vigilância Sanitária' }} />
      <Screen edges={['left', 'right', 'bottom']}>
        {catalog === null ? (
          <Notice
            tone="info"
            message="Os alertas de vigilância são baixados quando há internet. Conecte-se para carregar pela primeira vez."
          />
        ) : null}
        {onlyDemo ? (
          <Notice
            tone="warning"
            message="Nenhuma fonte oficial de dados está configurada. Os alertas abaixo são DEMO (fictícios) e servem apenas para mostrar como a tela funciona."
          />
        ) : null}
        {!state && all.length > 0 ? (
          <Notice
            tone="info"
            message="Informe o estado da fazenda em Perfil para destacar os alertas da sua região."
          />
        ) : null}

        {catalog !== null && all.length === 0 ? (
          <EmptyState
            icon="shield-check"
            title="Nenhum alerta de vigilância"
            text="Não há alertas publicados. Quando uma fonte oficial estiver configurada, os alertas da região aparecerão aqui com a indicação da fonte."
          />
        ) : null}

        {nearby.length > 0 ? <SectionTitle>{state ? `Na sua região (${state})` : 'Alertas'}</SectionTitle> : null}
        {nearby.map((alert) => (
          <AlertCard key={alert.id} alert={alert} />
        ))}

        {elsewhere.length > 0 ? <SectionTitle>Outras regiões</SectionTitle> : null}
        {elsewhere.map((alert) => (
          <AlertCard key={alert.id} alert={alert} />
        ))}

        <Disclaimer />
      </Screen>
    </>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.xs,
  },
  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  disease: { ...typography.heading, color: colors.text, flexShrink: 1 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginVertical: spacing.xs },
  demoNote: { ...typography.caption, color: colors.warning, fontWeight: '700' },
  label: { ...typography.caption, color: colors.textMuted, fontWeight: '700', marginTop: spacing.sm },
  text: { ...typography.body, color: colors.text },
  link: { ...typography.body, color: colors.info, textDecorationLine: 'underline' },
});

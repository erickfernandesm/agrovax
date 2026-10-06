import { RISK_LEVEL_LABEL, SPECIES_LABEL } from '@agrovax/shared';
import { Stack, useLocalSearchParams } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { DemoBadge, Disclaimer, Tag } from '../../../components/Bits';
import { Card } from '../../../components/Card';
import { NotFound } from '../../../components/NotFound';
import { Notice } from '../../../components/Notice';
import { Screen } from '../../../components/Screen';
import { useCatalog } from '../../../data/DataContext';
import { colors, spacing, typography } from '../../../theme/tokens';

function Section({ title, text }: { title: string; text: string | null }) {
  if (!text) return null;
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <Text style={styles.text}>{text}</Text>
    </View>
  );
}

export default function DiseaseScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const catalog = useCatalog();
  const disease = catalog?.diseases.find((item) => item.id === id) ?? null;

  if (!disease) {
    return (
      <>
        <Stack.Screen options={{ title: 'Doença' }} />
        <NotFound what="Conteúdo" />
      </>
    );
  }

  const symptoms = (catalog?.symptoms ?? []).filter((symptom) => disease.symptomIds.includes(symptom.id));

  return (
    <>
      <Stack.Screen options={{ title: disease.name }} />
      <Screen edges={['left', 'right', 'bottom']}>
        <View style={styles.header}>
          <Text style={styles.name}>{disease.name}</Text>
          {disease.isDemo ? <DemoBadge /> : null}
        </View>
        <View style={styles.tags}>
          {disease.species.map((species) => (
            <Tag key={species} label={SPECIES_LABEL[species]} tone="info" />
          ))}
          {disease.riskLevel ? <Tag label={`Risco ${RISK_LEVEL_LABEL[disease.riskLevel].toLowerCase()}`} tone="warning" /> : null}
        </View>

        {disease.isDemo ? (
          <Notice
            tone="warning"
            message="Conteúdo DEMO: os textos abaixo são exemplos sem validade técnica e não devem orientar nenhuma decisão."
          />
        ) : null}

        <Card>
          <Section title="Agente causador" text={disease.causativeAgent} />
          <Section title="Formas de transmissão" text={disease.transmission} />
          <Section title="Principais sintomas" text={disease.mainSymptoms} />
          {symptoms.length > 0 ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Sinais relacionados no catálogo</Text>
              <View style={styles.tags}>
                {symptoms.map((symptom) => (
                  <Tag key={symptom.id} label={symptom.name} />
                ))}
              </View>
            </View>
          ) : null}
          <Section title="Medidas de prevenção" text={disease.prevention} />
          <Section title="Vacinas disponíveis" text={disease.availableVaccines} />
          <Section title="Medicamentos preventivos" text={disease.preventiveMedications} />
          <Section title="Fonte" text={disease.source} />
        </Card>

        <Disclaimer />
      </Screen>
    </>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  name: { ...typography.title, color: colors.text, flexShrink: 1 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  section: { gap: spacing.xs },
  sectionTitle: { ...typography.label, color: colors.primaryDark },
  text: { ...typography.body, color: colors.text },
});

import {
  diseasesForSymptom,
  SYMPTOM_ASSOCIATION_NOTICE,
  SYMPTOM_INTENSITIES,
  SYMPTOM_INTENSITY_LABEL,
  todayIso,
  type DiseaseDto,
  type SymptomIntensity,
} from '@agrovax/shared';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import { DemoBadge, Disclaimer } from '../../../components/Bits';
import { Button } from '../../../components/Button';
import { ChipSelect, optionsFrom } from '../../../components/ChipSelect';
import { DateField } from '../../../components/DateField';
import { ListRow } from '../../../components/ListRow';
import { Notice } from '../../../components/Notice';
import { TextField } from '../../../components/TextField';
import { useCatalog, useStore } from '../../../data/DataContext';
import { registerSymptom } from '../../../data/operations';
import { useAuth } from '../../../features/auth/AuthContext';
import { RecordShell, useHealthTarget } from '../../../features/health/RecordShell';
import { nullIfEmpty, useRecordForm } from '../../../hooks/useRecordForm';
import { colors, typography } from '../../../theme/tokens';

const OTHER = 'OTHER';

export default function SymptomScreen() {
  const router = useRouter();
  const store = useStore();
  const { user } = useAuth();
  const catalog = useCatalog();
  const resolved = useHealthTarget();
  const symptoms = catalog?.symptoms ?? [];

  const form = useRecordForm({
    choice: null as string | null,
    otherName: '',
    observedAt: todayIso() as string | null,
    intensity: null as SymptomIntensity | null,
    responsible: user?.name ?? '',
    notes: '',
  });
  const { values } = form;
  /** Preenchido apos salvar: doencas do catalogo que listam o sintoma. */
  const [related, setRelated] = useState<DiseaseDto[] | null>(null);

  const useFreeText = values.choice === OTHER || symptoms.length === 0;

  const save = async () => {
    if (!resolved) return;
    const chosen = symptoms.find((symptom) => symptom.id === values.choice) ?? null;
    const symptomName = useFreeText ? values.otherName.trim() : (chosen?.name ?? '');

    const saved = await form.submit(async () => {
      await registerSymptom(store, resolved.target, {
        symptomId: chosen?.id ?? null,
        symptomName,
        observedAt: values.observedAt ?? '',
        intensity: values.intensity,
        responsible: nullIfEmpty(values.responsible),
        notes: nullIfEmpty(values.notes),
      });
    });
    if (!saved) return;

    const diseases = chosen ? diseasesForSymptom(chosen.id, catalog?.diseases ?? []) : [];
    if (diseases.length === 0) router.back();
    else setRelated(diseases);
  };

  if (related) {
    return (
      <RecordShell title="Sintoma registrado" resolved={resolved}>
        <Notice tone="success" message="Sintoma registrado no histórico." />
        <Notice tone="info" message={SYMPTOM_ASSOCIATION_NOTICE} />
        <Text style={styles.heading}>Para leitura na biblioteca</Text>
        {related.map((disease) => (
          <ListRow
            key={disease.id}
            icon="book-open-variant"
            title={disease.name}
            subtitle="Conteúdo educativo"
            right={disease.isDemo ? <DemoBadge /> : undefined}
            onPress={() => router.push({ pathname: '/diseases/[id]', params: { id: disease.id } })}
          />
        ))}
        <Button label="Concluir" onPress={() => router.back()} />
        <Disclaimer />
      </RecordShell>
    );
  }

  return (
    <RecordShell title="Registrar sintoma" resolved={resolved}>
      {form.formError ? <Notice tone="error" message={form.formError} /> : null}

      {symptoms.length > 0 ? (
        <ChipSelect
          label="Sinal observado"
          options={[
            ...symptoms.map((symptom) => ({ value: symptom.id, label: symptom.name })),
            { value: OTHER, label: 'Outro' },
          ]}
          value={values.choice}
          onChange={(choice) => form.set('choice', choice)}
          error={!useFreeText ? form.errors.symptomName : undefined}
        />
      ) : null}
      {useFreeText ? (
        <TextField
          label="Descreva o sinal observado"
          value={values.otherName}
          onChangeText={(text) => form.set('otherName', text)}
          error={form.errors.symptomName}
          autoCapitalize="sentences"
        />
      ) : null}

      <DateField
        label="Data da observação"
        value={values.observedAt}
        onChange={(date) => form.set('observedAt', date)}
        error={form.errors.observedAt}
      />
      <ChipSelect
        label="Intensidade (opcional)"
        options={optionsFrom(SYMPTOM_INTENSITIES, SYMPTOM_INTENSITY_LABEL)}
        value={values.intensity}
        onChange={(intensity) => form.set('intensity', intensity)}
        optional
      />
      <TextField
        label="Responsável (opcional)"
        value={values.responsible}
        onChangeText={(text) => form.set('responsible', text)}
        autoCapitalize="words"
      />
      <TextField
        label="Observações (opcional)"
        value={values.notes}
        onChangeText={(text) => form.set('notes', text)}
        multiline
      />
      <Button label="Registrar sintoma" loading={form.saving} onPress={() => void save()} />
      <Disclaimer />
    </RecordShell>
  );
}

const styles = StyleSheet.create({
  heading: { ...typography.heading, color: colors.text },
});

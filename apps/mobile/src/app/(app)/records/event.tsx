import {
  HEALTH_EVENT_TYPES,
  HEALTH_EVENT_TYPE_LABEL,
  todayIso,
  type HealthEventType,
} from '@agrovax/shared';
import { useRouter } from 'expo-router';
import { Button } from '../../../components/Button';
import { ChipSelect, optionsFrom } from '../../../components/ChipSelect';
import { DateField } from '../../../components/DateField';
import { Notice } from '../../../components/Notice';
import { TextField } from '../../../components/TextField';
import { useStore } from '../../../data/DataContext';
import { registerHealthEvent } from '../../../data/operations';
import { useAuth } from '../../../features/auth/AuthContext';
import { RecordShell, useHealthTarget } from '../../../features/health/RecordShell';
import { nullIfEmpty, useRecordForm } from '../../../hooks/useRecordForm';

export default function HealthEventScreen() {
  const router = useRouter();
  const store = useStore();
  const { user } = useAuth();
  const resolved = useHealthTarget();
  const form = useRecordForm({
    type: 'NOTE' as HealthEventType,
    title: '',
    description: '',
    occurredAt: todayIso() as string | null,
    responsible: user?.name ?? '',
  });
  const { values } = form;

  const save = async () => {
    if (!resolved) return;
    const saved = await form.submit(async () => {
      await registerHealthEvent(store, resolved.target, {
        type: values.type,
        title: values.title.trim(),
        description: nullIfEmpty(values.description),
        occurredAt: values.occurredAt ?? '',
        responsible: nullIfEmpty(values.responsible),
      });
    });
    if (saved) router.back();
  };

  return (
    <RecordShell title="Registrar evento" resolved={resolved}>
      {form.formError ? <Notice tone="error" message={form.formError} /> : null}
      <ChipSelect
        label="Tipo"
        options={optionsFrom(HEALTH_EVENT_TYPES, HEALTH_EVENT_TYPE_LABEL)}
        value={values.type}
        onChange={(type) => type && form.set('type', type)}
      />
      <TextField
        label="Título"
        value={values.title}
        onChangeText={(text) => form.set('title', text)}
        error={form.errors.title}
        placeholder="Ex.: Visita do veterinário"
        autoCapitalize="sentences"
      />
      <DateField
        label="Data"
        value={values.occurredAt}
        onChange={(date) => form.set('occurredAt', date)}
        error={form.errors.occurredAt}
      />
      <TextField
        label="Descrição (opcional)"
        value={values.description}
        onChangeText={(text) => form.set('description', text)}
        multiline
      />
      <TextField
        label="Responsável (opcional)"
        value={values.responsible}
        onChangeText={(text) => form.set('responsible', text)}
        autoCapitalize="words"
      />
      <Button label="Registrar evento" loading={form.saving} onPress={() => void save()} />
    </RecordShell>
  );
}

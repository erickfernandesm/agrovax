import { todayIso, TREATMENT_TYPES, TREATMENT_TYPE_LABEL, type TreatmentType } from '@agrovax/shared';
import { useRouter } from 'expo-router';
import { Button } from '../../../components/Button';
import { ChipSelect, optionsFrom } from '../../../components/ChipSelect';
import { DateField } from '../../../components/DateField';
import { Notice } from '../../../components/Notice';
import { TextField } from '../../../components/TextField';
import { useStore } from '../../../data/DataContext';
import { registerTreatment } from '../../../data/operations';
import { useAuth } from '../../../features/auth/AuthContext';
import { RecordShell, useHealthTarget } from '../../../features/health/RecordShell';
import { nullIfEmpty, useRecordForm } from '../../../hooks/useRecordForm';

export default function TreatmentScreen() {
  const router = useRouter();
  const store = useStore();
  const { user } = useAuth();
  const resolved = useHealthTarget();
  const form = useRecordForm({
    type: 'DEWORMER' as TreatmentType,
    product: '',
    appliedAt: todayIso() as string | null,
    nextApplicationAt: null as string | null,
    responsible: user?.name ?? '',
    notes: '',
  });
  const { values } = form;

  const save = async () => {
    if (!resolved) return;
    const saved = await form.submit(async () => {
      await registerTreatment(store, resolved.target, {
        type: values.type,
        product: values.product.trim(),
        appliedAt: values.appliedAt ?? '',
        nextApplicationAt: values.nextApplicationAt,
        responsible: nullIfEmpty(values.responsible),
        notes: nullIfEmpty(values.notes),
      });
    });
    if (saved) router.back();
  };

  return (
    <RecordShell title="Registrar tratamento" resolved={resolved}>
      {form.formError ? <Notice tone="error" message={form.formError} /> : null}
      <ChipSelect
        label="Tipo de tratamento preventivo"
        options={optionsFrom(TREATMENT_TYPES, TREATMENT_TYPE_LABEL)}
        value={values.type}
        onChange={(type) => type && form.set('type', type)}
      />
      <TextField
        label="Produto"
        value={values.product}
        onChangeText={(text) => form.set('product', text)}
        error={form.errors.product}
        autoCapitalize="sentences"
      />
      <DateField
        label="Data da aplicação"
        value={values.appliedAt}
        onChange={(date) => form.set('appliedAt', date)}
        error={form.errors.appliedAt}
      />
      <DateField
        label="Próxima aplicação (opcional)"
        value={values.nextApplicationAt}
        onChange={(date) => form.set('nextApplicationAt', date)}
        error={form.errors.nextApplicationAt}
        hint="Informe a data indicada pelo médico-veterinário ou pela bula."
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
      <Button label="Registrar tratamento" loading={form.saving} onPress={() => void save()} />
    </RecordShell>
  );
}

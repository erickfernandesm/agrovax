import { todayIso } from '@agrovax/shared';
import { useRouter } from 'expo-router';
import { Button } from '../../../components/Button';
import { DateField } from '../../../components/DateField';
import { Notice } from '../../../components/Notice';
import { TextField } from '../../../components/TextField';
import { useStore } from '../../../data/DataContext';
import { registerVaccination } from '../../../data/operations';
import { useAuth } from '../../../features/auth/AuthContext';
import { RecordShell, useHealthTarget } from '../../../features/health/RecordShell';
import { nullIfEmpty, useRecordForm } from '../../../hooks/useRecordForm';

export default function VaccinationScreen() {
  const router = useRouter();
  const store = useStore();
  const { user } = useAuth();
  const resolved = useHealthTarget();
  const form = useRecordForm({
    vaccineName: '',
    appliedAt: todayIso() as string | null,
    nextDoseAt: null as string | null,
    responsible: user?.name ?? '',
    notes: '',
  });
  const { values } = form;

  const save = async () => {
    if (!resolved) return;
    const saved = await form.submit(async () => {
      await registerVaccination(store, resolved.target, {
        vaccineName: values.vaccineName.trim(),
        // Data vazia ou invalida e barrada pela validacao, com mensagem no campo.
        appliedAt: values.appliedAt ?? '',
        nextDoseAt: values.nextDoseAt,
        responsible: nullIfEmpty(values.responsible),
        notes: nullIfEmpty(values.notes),
      });
    });
    if (saved) router.back();
  };

  return (
    <RecordShell title="Registrar vacinação" resolved={resolved}>
      {form.formError ? <Notice tone="error" message={form.formError} /> : null}
      <TextField
        label="Nome da vacina"
        value={values.vaccineName}
        onChangeText={(text) => form.set('vaccineName', text)}
        error={form.errors.vaccineName}
        autoCapitalize="sentences"
      />
      <DateField
        label="Data da aplicação"
        value={values.appliedAt}
        onChange={(date) => form.set('appliedAt', date)}
        error={form.errors.appliedAt}
      />
      <DateField
        label="Próxima dose (opcional)"
        value={values.nextDoseAt}
        onChange={(date) => form.set('nextDoseAt', date)}
        error={form.errors.nextDoseAt}
        hint="Informe a data indicada pelo médico-veterinário ou pela bula. O AgroVax avisa 30, 15 e 7 dias antes."
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
      <Button label="Registrar vacinação" loading={form.saving} onPress={() => void save()} />
    </RecordShell>
  );
}

import {
  CATEGORIES_BY_SPECIES,
  CATEGORY_LABEL,
  planUsage,
  PURPOSES,
  PURPOSE_LABEL,
  SPECIES,
  SPECIES_LABEL,
  type EntityData,
  type LotRecord,
} from '@agrovax/shared';
import { useRouter } from 'expo-router';
import { Button } from '../../components/Button';
import { ChipSelect, optionsFrom } from '../../components/ChipSelect';
import { Notice } from '../../components/Notice';
import { Screen } from '../../components/Screen';
import { TextField } from '../../components/TextField';
import { useRecords, useStore } from '../../data/DataContext';
import { nullIfEmpty, useRecordForm } from '../../hooks/useRecordForm';
import { useAuth } from '../auth/AuthContext';

type LotData = EntityData['lot'];

interface FormValues {
  name: string;
  quantity: string;
  species: LotData['species'];
  category: LotData['category'];
  purpose: LotData['purpose'];
  ageRange: string;
  location: string;
  notes: string;
}

export function LotForm({ lot = null }: { lot?: LotRecord | null }) {
  const router = useRouter();
  const store = useStore();
  const { activeFarm } = useAuth();
  const animals = useRecords('animal');
  const lots = useRecords('lot');

  const form = useRecordForm<FormValues>({
    name: lot?.name ?? '',
    quantity: lot ? String(lot.declaredQuantity) : '',
    species: lot?.species ?? 'BOVINE',
    category: lot?.category ?? null,
    purpose: lot?.purpose ?? null,
    ageRange: lot?.ageRange ?? '',
    location: lot?.location ?? '',
    notes: lot?.notes ?? '',
  });
  const { values } = form;

  const limits = activeFarm?.subscription.limits;
  const limitReached = !lot && limits ? planUsage({ animals, lots }, limits).lots.reached : false;

  const save = async () => {
    const quantity = values.quantity.trim() === '' ? NaN : Number(values.quantity);
    const data: LotData = {
      name: values.name.trim(),
      // Valor invalido e barrado pela validacao, com a mensagem no campo.
      declaredQuantity: Number.isInteger(quantity) ? quantity : -1,
      species: values.species,
      category: values.category,
      purpose: values.species === 'BOVINE' ? values.purpose : null,
      ageRange: nullIfEmpty(values.ageRange),
      location: nullIfEmpty(values.location),
      notes: nullIfEmpty(values.notes),
    };

    let savedId = lot?.id ?? null;
    const saved = await form.submit(async () => {
      if (lot) await store.update('lot', lot.id, data);
      else savedId = (await store.create('lot', data)).id;
    });
    if (!saved || !savedId) return;
    if (lot) router.back();
    else router.replace({ pathname: '/lots/[id]', params: { id: savedId } });
  };

  return (
    <Screen edges={['left', 'right', 'bottom']}>
      {limitReached ? (
        <Notice
          tone="warning"
          message={`Seu plano permite até ${limits?.maxLots} lotes. Para criar mais, mude de plano.`}
        />
      ) : null}
      {form.formError ? <Notice tone="error" message={form.formError} /> : null}

      <TextField
        label="Nome do lote"
        value={values.name}
        onChangeText={(text) => form.set('name', text)}
        error={form.errors.name}
        placeholder="Ex.: Bezerros 2026"
        autoCapitalize="words"
      />
      <TextField
        label="Quantidade de animais"
        value={values.quantity}
        onChangeText={(text) => form.set('quantity', text.replace(/\D/g, '').slice(0, 7))}
        error={form.errors.declaredQuantity}
        hint="Número de cabeças do lote. Não é preciso cadastrar cada animal."
        keyboardType="number-pad"
      />
      <ChipSelect
        label="Espécie"
        options={optionsFrom(SPECIES, SPECIES_LABEL)}
        value={values.species}
        onChange={(species) => {
          if (!species || species === values.species) return;
          form.set('species', species);
          form.set('category', null);
        }}
      />
      <ChipSelect
        label="Categoria (opcional)"
        options={optionsFrom(CATEGORIES_BY_SPECIES[values.species], CATEGORY_LABEL)}
        value={values.category}
        onChange={(category) => form.set('category', category)}
        optional
      />
      {values.species === 'BOVINE' ? (
        <ChipSelect
          label="Finalidade (opcional)"
          options={optionsFrom(PURPOSES, PURPOSE_LABEL)}
          value={values.purpose}
          onChange={(purpose) => form.set('purpose', purpose)}
          optional
        />
      ) : null}
      <TextField
        label="Faixa etária (opcional)"
        value={values.ageRange}
        onChangeText={(text) => form.set('ageRange', text)}
        placeholder="Ex.: 0 a 8 meses"
      />
      <TextField
        label="Localização na fazenda (opcional)"
        value={values.location}
        onChangeText={(text) => form.set('location', text)}
        placeholder="Ex.: Pasto 3"
        autoCapitalize="sentences"
      />
      <TextField
        label="Observações (opcional)"
        value={values.notes}
        onChangeText={(text) => form.set('notes', text)}
        multiline
      />

      <Button
        label={lot ? 'Salvar alterações' : 'Salvar lote'}
        loading={form.saving}
        disabled={limitReached}
        onPress={() => void save()}
      />
    </Screen>
  );
}

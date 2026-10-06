import {
  ANIMAL_STATUSES,
  ANIMAL_STATUS_LABEL,
  CATEGORIES_BY_SPECIES,
  CATEGORY_LABEL,
  planUsage,
  PURPOSES,
  PURPOSE_LABEL,
  SEXES,
  SEX_LABEL,
  SPECIES,
  SPECIES_LABEL,
  type AnimalRecord,
  type EntityData,
} from '@agrovax/shared';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { Button } from '../../components/Button';
import { ChipSelect, optionsFrom } from '../../components/ChipSelect';
import { DateField } from '../../components/DateField';
import { Notice } from '../../components/Notice';
import { Screen } from '../../components/Screen';
import { TextField } from '../../components/TextField';
import { useRecords, useStore } from '../../data/DataContext';
import { nullIfEmpty, useRecordForm } from '../../hooks/useRecordForm';
import { loadAnimalPhoto, pickPhoto, saveAnimalPhoto, type PhotoSource } from '../../services/photos';
import { colors, radius, spacing, typography } from '../../theme/tokens';
import { useAuth } from '../auth/AuthContext';

type AnimalData = EntityData['animal'];

interface FormValues extends Omit<AnimalData, 'name' | 'breed' | 'ownerName' | 'notes'> {
  name: string;
  breed: string;
  ownerName: string;
  notes: string;
}

function toValues(animal: AnimalRecord | null, lotId: string | null): FormValues {
  return {
    lotId: animal?.lotId ?? lotId,
    tag: animal?.tag ?? '',
    name: animal?.name ?? '',
    species: animal?.species ?? 'BOVINE',
    sex: animal?.sex ?? 'FEMALE',
    birthDate: animal?.birthDate ?? null,
    breed: animal?.breed ?? '',
    category: animal?.category ?? null,
    purpose: animal?.purpose ?? null,
    ownerName: animal?.ownerName ?? '',
    status: animal?.status ?? 'ACTIVE',
    notes: animal?.notes ?? '',
  };
}

interface AnimalFormProps {
  /** Animal em edicao; ausente no cadastro. */
  animal?: AnimalRecord | null;
  /** Lote pre-selecionado ao cadastrar a partir da tela de um lote. */
  initialLotId?: string | null;
}

export function AnimalForm({ animal = null, initialLotId = null }: AnimalFormProps) {
  const router = useRouter();
  const store = useStore();
  const { activeFarm } = useAuth();
  const animals = useRecords('animal');
  const lots = useRecords('lot');
  const form = useRecordForm(toValues(animal, initialLotId));
  const { values } = form;

  const [photo, setPhoto] = useState<string | null>(null);
  const [photoChanged, setPhotoChanged] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);

  useEffect(() => {
    if (animal) void loadAnimalPhoto(animal.id).then(setPhoto);
  }, [animal]);

  const limits = activeFarm?.subscription.limits;
  const limitReached = !animal && limits ? planUsage({ animals, lots }, limits).animals.reached : false;

  const duplicateTag =
    values.tag.trim() !== '' &&
    animals.some(
      (other) => other.id !== animal?.id && other.tag.toLowerCase() === values.tag.trim().toLowerCase(),
    );

  const lotOptions = lots
    .filter((lot) => lot.species === values.species)
    .map((lot) => ({ value: lot.id, label: lot.name }));

  const choosePhoto = async (source: PhotoSource) => {
    setPhotoError(null);
    try {
      const picked = await pickPhoto(source);
      if (picked) {
        setPhoto(picked);
        setPhotoChanged(true);
      }
    } catch (error) {
      setPhotoError(error instanceof Error ? error.message : 'Não foi possível obter a foto.');
    }
  };

  const save = async () => {
    const data: AnimalData = {
      ...values,
      tag: values.tag.trim(),
      name: nullIfEmpty(values.name),
      breed: nullIfEmpty(values.breed),
      ownerName: nullIfEmpty(values.ownerName),
      notes: nullIfEmpty(values.notes),
      purpose: values.species === 'BOVINE' ? values.purpose : null,
      // Um lote de outra especie deixa de valer quando a especie muda.
      lotId: lotOptions.some((lot) => lot.value === values.lotId) ? values.lotId : null,
    };

    let savedId = animal?.id ?? null;
    const saved = await form.submit(async () => {
      if (animal) await store.update('animal', animal.id, data);
      else savedId = (await store.create('animal', data)).id;
    });
    if (!saved || !savedId) return;

    if (photoChanged) {
      // A foto e opcional: se nao couber no aparelho, o cadastro continua valido.
      await saveAnimalPhoto(savedId, photo).catch(() => undefined);
    }
    if (animal) router.back();
    else router.replace({ pathname: '/animals/[id]', params: { id: savedId } });
  };

  return (
    <Screen edges={['left', 'right', 'bottom']}>
      {limitReached ? (
        <Notice
          tone="warning"
          message={`Seu plano permite até ${limits?.maxAnimals} animais cadastrados individualmente. Para cadastrar mais, use lotes ou mude de plano.`}
        />
      ) : null}
      {form.formError ? <Notice tone="error" message={form.formError} /> : null}

      <TextField
        label="Brinco / identificação"
        value={values.tag}
        onChangeText={(text) => form.set('tag', text)}
        error={form.errors.tag}
        hint={duplicateTag ? 'Já existe um animal com esta identificação.' : undefined}
        autoCapitalize="characters"
      />
      <TextField
        label="Nome (opcional)"
        value={values.name}
        onChangeText={(text) => form.set('name', text)}
        error={form.errors.name}
        autoCapitalize="words"
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
        label="Sexo"
        options={optionsFrom(SEXES, SEX_LABEL)}
        value={values.sex}
        onChange={(sex) => sex && form.set('sex', sex)}
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

      <DateField
        label="Data de nascimento (opcional)"
        value={values.birthDate}
        onChange={(date) => form.set('birthDate', date)}
        error={form.errors.birthDate}
      />
      <TextField
        label="Raça (opcional)"
        value={values.breed}
        onChangeText={(text) => form.set('breed', text)}
        autoCapitalize="words"
      />
      <TextField
        label="Proprietário (opcional)"
        value={values.ownerName}
        onChangeText={(text) => form.set('ownerName', text)}
        autoCapitalize="words"
      />

      {lotOptions.length > 0 ? (
        <ChipSelect
          label="Lote (opcional)"
          options={lotOptions}
          value={values.lotId}
          onChange={(lotId) => form.set('lotId', lotId)}
          optional
        />
      ) : null}

      {animal ? (
        <ChipSelect
          label="Situação"
          options={optionsFrom(ANIMAL_STATUSES, ANIMAL_STATUS_LABEL)}
          value={values.status}
          onChange={(status) => status && form.set('status', status)}
        />
      ) : null}

      <TextField
        label="Observações (opcional)"
        value={values.notes}
        onChangeText={(text) => form.set('notes', text)}
        multiline
      />

      <View style={styles.photoBlock}>
        <Text style={styles.label}>Foto (opcional)</Text>
        {photo ? <Image source={{ uri: photo }} style={styles.photo} accessibilityLabel="Foto do animal" /> : null}
        {photoError ? <Notice tone="error" message={photoError} /> : null}
        <View style={styles.photoButtons}>
          <View style={styles.flex}>
            <Button label="Tirar foto" variant="secondary" onPress={() => void choosePhoto('camera')} />
          </View>
          <View style={styles.flex}>
            <Button label="Galeria" variant="secondary" onPress={() => void choosePhoto('library')} />
          </View>
        </View>
        {photo ? (
          <Button
            label="Remover foto"
            variant="ghost"
            onPress={() => {
              setPhoto(null);
              setPhotoChanged(true);
            }}
          />
        ) : null}
        <Text style={styles.hint}>A foto fica guardada somente neste aparelho.</Text>
      </View>

      <Button
        label={animal ? 'Salvar alterações' : 'Salvar animal'}
        loading={form.saving}
        disabled={limitReached}
        onPress={() => void save()}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  label: { ...typography.label, color: colors.text },
  hint: { ...typography.caption, color: colors.textMuted },
  photoBlock: { gap: spacing.sm },
  photo: { width: 140, height: 140, borderRadius: radius.lg, backgroundColor: colors.surfaceMuted },
  photoButtons: { flexDirection: 'row', gap: spacing.sm },
});

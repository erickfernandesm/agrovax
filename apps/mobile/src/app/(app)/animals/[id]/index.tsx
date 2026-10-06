import {
  ANIMAL_STATUS_LABEL,
  CATEGORY_LABEL,
  formatDateBr,
  PURPOSE_LABEL,
  SEX_LABEL,
  SPECIES_LABEL,
} from '@agrovax/shared';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { Disclaimer, Field, Tag } from '../../../../components/Bits';
import { Button } from '../../../../components/Button';
import { Card } from '../../../../components/Card';
import { NotFound } from '../../../../components/NotFound';
import { Screen } from '../../../../components/Screen';
import { useRecord, useRecords, useStore } from '../../../../data/DataContext';
import { removeAnimal, type HealthTarget } from '../../../../data/operations';
import { HealthPanel } from '../../../../features/health/HealthPanel';
import { confirm } from '../../../../lib/confirm';
import { loadAnimalPhoto } from '../../../../services/photos';
import { colors, radius, spacing, typography } from '../../../../theme/tokens';

export default function AnimalScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const store = useStore();
  const animal = useRecord('animal', id);
  const lots = useRecords('lot');
  const [photo, setPhoto] = useState<string | null>(null);

  const target = useMemo<HealthTarget>(() => ({ type: 'animal', id }), [id]);

  // Recarrega a foto ao voltar da edicao (updatedAt muda quando o cadastro e salvo).
  useEffect(() => {
    void loadAnimalPhoto(id).then(setPhoto);
  }, [id, animal?.updatedAt]);

  if (!animal) {
    return (
      <>
        <Stack.Screen options={{ title: 'Animal' }} />
        <NotFound what="Animal" />
      </>
    );
  }

  const lot = lots.find((item) => item.id === animal.lotId) ?? null;

  const remove = async () => {
    const accepted = await confirm(
      'Excluir animal',
      `Excluir o cadastro de ${animal.tag}? Se o animal foi vendido ou morreu, prefira mudar a situação em "Editar", para manter o histórico.`,
    );
    if (!accepted) return;
    await removeAnimal(store, animal.id);
    router.back();
  };

  return (
    <>
      <Stack.Screen options={{ title: animal.tag }} />
      <Screen edges={['left', 'right', 'bottom']}>
        <View style={styles.header}>
          {photo ? <Image source={{ uri: photo }} style={styles.photo} accessibilityLabel="Foto do animal" /> : null}
          <View style={styles.headerTexts}>
            <Text style={styles.tag}>{animal.tag}</Text>
            {animal.name ? <Text style={styles.name}>{animal.name}</Text> : null}
            <Tag
              label={ANIMAL_STATUS_LABEL[animal.status]}
              tone={animal.status === 'ACTIVE' ? 'success' : 'neutral'}
            />
          </View>
        </View>

        <Card>
          <Field label="Espécie" value={SPECIES_LABEL[animal.species]} />
          <Field label="Sexo" value={SEX_LABEL[animal.sex]} />
          <Field label="Categoria" value={animal.category ? CATEGORY_LABEL[animal.category] : null} />
          <Field label="Finalidade" value={animal.purpose ? PURPOSE_LABEL[animal.purpose] : null} />
          <Field label="Nascimento" value={formatDateBr(animal.birthDate)} />
          <Field label="Raça" value={animal.breed} />
          <Field label="Proprietário" value={animal.ownerName} />
          <Field label="Lote" value={lot?.name} />
          <Field label="Observações" value={animal.notes} />
        </Card>

        <Button
          label="Editar dados"
          variant="secondary"
          onPress={() => router.push({ pathname: '/animals/[id]/edit', params: { id: animal.id } })}
        />

        <HealthPanel target={target} />

        <Button label="Excluir animal" variant="danger" onPress={() => void remove()} />
        <Disclaimer />
      </Screen>
    </>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  photo: { width: 96, height: 96, borderRadius: radius.lg, backgroundColor: colors.surfaceMuted },
  headerTexts: { flex: 1, gap: spacing.xs },
  tag: { ...typography.title, color: colors.text },
  name: { ...typography.body, color: colors.textMuted },
});

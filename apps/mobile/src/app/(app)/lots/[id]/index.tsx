import {
  CATEGORY_LABEL,
  identifiedInLot,
  lotHeadcount,
  PURPOSE_LABEL,
  SPECIES_LABEL,
} from '@agrovax/shared';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Disclaimer, Field, SectionTitle } from '../../../../components/Bits';
import { Button } from '../../../../components/Button';
import { Card } from '../../../../components/Card';
import { ListRow } from '../../../../components/ListRow';
import { NotFound } from '../../../../components/NotFound';
import { Notice } from '../../../../components/Notice';
import { Screen } from '../../../../components/Screen';
import { useRecord, useRecords, useStore } from '../../../../data/DataContext';
import { removeLot, type HealthTarget } from '../../../../data/operations';
import { HealthPanel } from '../../../../features/health/HealthPanel';
import { animalTitle, describeAnimal, heads, SPECIES_ICON } from '../../../../features/herd/describe';
import { confirm } from '../../../../lib/confirm';
import { colors, spacing, typography } from '../../../../theme/tokens';

export default function LotScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const store = useStore();
  const lot = useRecord('lot', id);
  const animals = useRecords('animal');
  const target = useMemo<HealthTarget>(() => ({ type: 'lot', id }), [id]);

  if (!lot) {
    return (
      <>
        <Stack.Screen options={{ title: 'Lote' }} />
        <NotFound what="Lote" />
      </>
    );
  }

  const count = lotHeadcount(lot, animals);
  const identified = identifiedInLot(lot.id, animals);

  const remove = async () => {
    const accepted = await confirm(
      'Excluir lote',
      `Excluir o lote ${lot.name}? Os animais cadastrados individualmente continuam no sistema, sem lote.`,
    );
    if (!accepted) return;
    await removeLot(store, lot.id);
    router.back();
  };

  return (
    <>
      <Stack.Screen options={{ title: lot.name }} />
      <Screen edges={['left', 'right', 'bottom']}>
        <View>
          <Text style={styles.name}>{lot.name}</Text>
          <Text style={styles.heads}>{heads(count.effective)}</Text>
        </View>

        {count.identified > count.declared ? (
          <Notice
            tone="warning"
            message={`Há ${count.identified} animais identificados neste lote, mais do que a quantidade informada (${count.declared}). Atualize a quantidade em "Editar dados".`}
          />
        ) : null}

        <Card>
          <Field label="Quantidade informada" value={heads(count.declared)} />
          <Field
            label="Identificados individualmente"
            value={count.identified > 0 ? String(count.identified) : 'Nenhum'}
          />
          <Field label="Espécie" value={SPECIES_LABEL[lot.species]} />
          <Field label="Categoria" value={lot.category ? CATEGORY_LABEL[lot.category] : null} />
          <Field label="Finalidade" value={lot.purpose ? PURPOSE_LABEL[lot.purpose] : null} />
          <Field label="Faixa etária" value={lot.ageRange} />
          <Field label="Localização" value={lot.location} />
          <Field label="Observações" value={lot.notes} />
        </Card>

        <Button
          label="Editar dados"
          variant="secondary"
          onPress={() => router.push({ pathname: '/lots/[id]/edit', params: { id: lot.id } })}
        />

        <HealthPanel target={target} />
        {identified.length > 0 ? (
          <Text style={styles.hint}>
            Vacinas e tratamentos registrados no lote também entram no histórico dos {identified.length}{' '}
            animais identificados.
          </Text>
        ) : null}

        <SectionTitle>Animais identificados</SectionTitle>
        {identified.length === 0 ? (
          <Text style={styles.hint}>
            Este lote é controlado pela quantidade. Cadastrar animais individualmente é opcional.
          </Text>
        ) : (
          identified.map((animal) => (
            <ListRow
              key={animal.id}
              icon={SPECIES_ICON[animal.species]}
              title={animalTitle(animal)}
              subtitle={describeAnimal(animal)}
              onPress={() => router.push({ pathname: '/animals/[id]', params: { id: animal.id } })}
            />
          ))
        )}
        <Button
          label="Cadastrar animal neste lote"
          variant="secondary"
          onPress={() => router.push({ pathname: '/animals/new', params: { lotId: lot.id } })}
        />

        <Button label="Excluir lote" variant="danger" onPress={() => void remove()} />
        <Disclaimer />
      </Screen>
    </>
  );
}

const styles = StyleSheet.create({
  name: { ...typography.title, color: colors.text },
  heads: { ...typography.heading, color: colors.primary, marginTop: spacing.xs },
  hint: { ...typography.caption, color: colors.textMuted },
});

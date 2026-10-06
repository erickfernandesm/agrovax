import {
  CATEGORY_LABEL,
  lotHeadcount,
  type Category,
  type Species,
} from '@agrovax/shared';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { EmptyState } from '../../../components/Bits';
import { Button } from '../../../components/Button';
import { ChipSelect } from '../../../components/ChipSelect';
import { ListRow } from '../../../components/ListRow';
import { SyncBadge } from '../../../components/SyncBadge';
import { useRecords } from '../../../data/DataContext';
import { describeLot, heads, SPECIES_ICON } from '../../../features/herd/describe';
import { colors, spacing, typography } from '../../../theme/tokens';

type SpeciesFilter = 'ALL' | Species;

const SPECIES_OPTIONS: { value: SpeciesFilter; label: string }[] = [
  { value: 'ALL', label: 'Todos' },
  { value: 'BOVINE', label: 'Bovinos' },
  { value: 'EQUINE', label: 'Equinos' },
];

export default function HerdsScreen() {
  const router = useRouter();
  const lots = useRecords('lot');
  const animals = useRecords('animal');
  const [species, setSpecies] = useState<SpeciesFilter>('ALL');
  const [category, setCategory] = useState<Category | null>(null);

  const bySpecies = useMemo(
    () => lots.filter((lot) => species === 'ALL' || lot.species === species),
    [lots, species],
  );
  // So oferece as categorias que existem nos lotes exibidos.
  const categoryOptions = useMemo(() => {
    const present = [...new Set(bySpecies.map((lot) => lot.category).filter((c): c is Category => c !== null))];
    return present.map((value) => ({ value, label: CATEGORY_LABEL[value] }));
  }, [bySpecies]);

  const visible = useMemo(
    () =>
      bySpecies
        .filter((lot) => category === null || lot.category === category)
        .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR', { numeric: true })),
    [bySpecies, category],
  );
  const total = visible.reduce((sum, lot) => sum + lotHeadcount(lot, animals).effective, 0);

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <FlatList
        data={visible}
        keyExtractor={(lot) => lot.id}
        contentContainerStyle={styles.content}
        ListHeaderComponent={
          <View style={styles.header}>
            <View style={styles.titleRow}>
              <Text style={styles.title}>Rebanhos</Text>
              <SyncBadge />
            </View>
            <Button label="Novo lote" onPress={() => router.push('/lots/new')} />
            <ChipSelect
              options={SPECIES_OPTIONS}
              value={species}
              onChange={(value) => {
                if (!value) return;
                setSpecies(value);
                setCategory(null);
              }}
            />
            {categoryOptions.length > 1 ? (
              <ChipSelect
                label="Categoria"
                options={categoryOptions}
                value={category}
                onChange={setCategory}
                optional
              />
            ) : null}
            <Text style={styles.count}>
              {visible.length} {visible.length === 1 ? 'lote' : 'lotes'} · {heads(total)}
            </Text>
          </View>
        }
        ListEmptyComponent={
          <EmptyState
            icon="fence"
            title={lots.length === 0 ? 'Nenhum lote cadastrado' : 'Nenhum lote encontrado'}
            text={
              lots.length === 0
                ? 'Crie um lote para controlar muitos animais de uma vez, sem cadastrar cada um.'
                : 'Ajuste os filtros.'
            }
          />
        }
        renderItem={({ item }) => {
          const count = lotHeadcount(item, animals);
          const identified = count.identified > 0 ? ` (${count.identified} identificados)` : '';
          return (
            <ListRow
              icon={SPECIES_ICON[item.species]}
              title={item.name}
              subtitle={`${heads(count.effective)}${identified}\n${describeLot(item)}`}
              onPress={() => router.push({ pathname: '/lots/[id]', params: { id: item.id } })}
            />
          );
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.xl, gap: spacing.md },
  header: { gap: spacing.md, marginBottom: spacing.xs },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { ...typography.title, color: colors.text },
  count: { ...typography.caption, color: colors.textMuted, fontWeight: '700' },
});

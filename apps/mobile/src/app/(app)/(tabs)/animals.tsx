import { ANIMAL_STATUS_LABEL, type AnimalRecord, type Species } from '@agrovax/shared';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { EmptyState, Tag } from '../../../components/Bits';
import { Button } from '../../../components/Button';
import { ChipSelect } from '../../../components/ChipSelect';
import { ListRow } from '../../../components/ListRow';
import { SyncBadge } from '../../../components/SyncBadge';
import { TextField } from '../../../components/TextField';
import { useRecords } from '../../../data/DataContext';
import { animalTitle, describeAnimal, SPECIES_ICON } from '../../../features/herd/describe';
import { colors, spacing, typography } from '../../../theme/tokens';

type SpeciesFilter = 'ALL' | Species;
type StatusFilter = 'ACTIVE' | 'ALL';

const SPECIES_OPTIONS: { value: SpeciesFilter; label: string }[] = [
  { value: 'ALL', label: 'Todos' },
  { value: 'BOVINE', label: 'Bovinos' },
  { value: 'EQUINE', label: 'Equinos' },
];
const STATUS_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: 'ACTIVE', label: 'Somente ativos' },
  { value: 'ALL', label: 'Incluir vendidos e baixados' },
];

export default function AnimalsScreen() {
  const router = useRouter();
  const animals = useRecords('animal');
  const lots = useRecords('lot');
  const [species, setSpecies] = useState<SpeciesFilter>('ALL');
  const [status, setStatus] = useState<StatusFilter>('ACTIVE');
  const [search, setSearch] = useState('');

  const lotNames = useMemo(() => new Map(lots.map((lot) => [lot.id, lot.name])), [lots]);

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    return animals
      .filter((animal) => species === 'ALL' || animal.species === species)
      .filter((animal) => status === 'ALL' || animal.status === 'ACTIVE')
      .filter(
        (animal) =>
          term === '' ||
          animal.tag.toLowerCase().includes(term) ||
          (animal.name ?? '').toLowerCase().includes(term) ||
          (animal.breed ?? '').toLowerCase().includes(term),
      )
      .sort((a, b) => a.tag.localeCompare(b.tag, 'pt-BR', { numeric: true }));
  }, [animals, species, status, search]);

  const subtitle = (animal: AnimalRecord) => {
    const lot = animal.lotId ? lotNames.get(animal.lotId) : null;
    return [describeAnimal(animal), lot ? `Lote ${lot}` : null].filter(Boolean).join(' · ');
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <FlatList
        data={visible}
        keyExtractor={(animal) => animal.id}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        initialNumToRender={12}
        ListHeaderComponent={
          <View style={styles.header}>
            <View style={styles.titleRow}>
              <Text style={styles.title}>Animais</Text>
              <SyncBadge />
            </View>
            <Button label="Novo animal" onPress={() => router.push('/animals/new')} />
            <TextField
              label="Buscar"
              value={search}
              onChangeText={setSearch}
              placeholder="Brinco, nome ou raça"
              autoCapitalize="none"
              autoCorrect={false}
            />
            <ChipSelect options={SPECIES_OPTIONS} value={species} onChange={(v) => v && setSpecies(v)} />
            <ChipSelect options={STATUS_OPTIONS} value={status} onChange={(v) => v && setStatus(v)} />
            <Text style={styles.count}>
              {visible.length} {visible.length === 1 ? 'animal' : 'animais'}
            </Text>
          </View>
        }
        ListEmptyComponent={
          <EmptyState
            icon="cow"
            title={animals.length === 0 ? 'Nenhum animal cadastrado' : 'Nenhum animal encontrado'}
            text={
              animals.length === 0
                ? 'Cadastre aqui os animais que você controla um a um, como touros reprodutores e cavalos.'
                : 'Ajuste a busca ou os filtros.'
            }
          />
        }
        renderItem={({ item }) => (
          <ListRow
            icon={SPECIES_ICON[item.species]}
            title={animalTitle(item)}
            subtitle={subtitle(item)}
            right={item.status === 'ACTIVE' ? undefined : <Tag label={ANIMAL_STATUS_LABEL[item.status]} />}
            onPress={() => router.push({ pathname: '/animals/[id]', params: { id: item.id } })}
          />
        )}
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

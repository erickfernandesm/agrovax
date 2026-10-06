import { SPECIES_LABEL, type Species } from '@agrovax/shared';
import { Stack, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { DemoBadge, Disclaimer, EmptyState } from '../../../components/Bits';
import { ChipSelect } from '../../../components/ChipSelect';
import { ListRow } from '../../../components/ListRow';
import { Notice } from '../../../components/Notice';
import { Screen } from '../../../components/Screen';
import { TextField } from '../../../components/TextField';
import { useCatalog } from '../../../data/DataContext';

type SpeciesFilter = 'ALL' | Species;
const OPTIONS: { value: SpeciesFilter; label: string }[] = [
  { value: 'ALL', label: 'Todas' },
  { value: 'BOVINE', label: 'Bovinos' },
  { value: 'EQUINE', label: 'Equinos' },
];

export default function DiseasesScreen() {
  const router = useRouter();
  const catalog = useCatalog();
  const [species, setSpecies] = useState<SpeciesFilter>('ALL');
  const [search, setSearch] = useState('');

  const diseases = useMemo(() => {
    const term = search.trim().toLowerCase();
    return (catalog?.diseases ?? [])
      .filter((disease) => species === 'ALL' || disease.species.includes(species))
      .filter((disease) => term === '' || disease.name.toLowerCase().includes(term));
  }, [catalog, species, search]);

  const hasDemo = (catalog?.diseases ?? []).some((disease) => disease.isDemo);

  return (
    <>
      <Stack.Screen options={{ title: 'Biblioteca de Doenças' }} />
      <Screen edges={['left', 'right', 'bottom']}>
        {catalog === null ? (
          <Notice
            tone="info"
            message="A biblioteca é baixada quando há internet. Conecte-se para carregar pela primeira vez."
          />
        ) : null}
        {hasDemo ? (
          <Notice
            tone="warning"
            message="Os itens marcados como DEMO têm texto de exemplo, sem validade técnica. O conteúdo definitivo será revisado por médico-veterinário."
          />
        ) : null}

        <TextField label="Buscar doença" value={search} onChangeText={setSearch} autoCorrect={false} />
        <ChipSelect options={OPTIONS} value={species} onChange={(value) => value && setSpecies(value)} />

        {catalog !== null && diseases.length === 0 ? (
          <EmptyState
            icon="book-open-variant"
            title="Nenhuma doença encontrada"
            text="Ajuste a busca ou o filtro de espécie."
          />
        ) : null}
        {diseases.map((disease) => (
          <ListRow
            key={disease.id}
            icon="book-open-variant"
            title={disease.name}
            subtitle={disease.species.map((item) => SPECIES_LABEL[item]).join(' e ')}
            right={disease.isDemo ? <DemoBadge /> : undefined}
            onPress={() => router.push({ pathname: '/diseases/[id]', params: { id: disease.id } })}
          />
        ))}
        <Disclaimer />
      </Screen>
    </>
  );
}

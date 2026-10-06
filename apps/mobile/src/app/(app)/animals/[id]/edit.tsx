import { Stack, useLocalSearchParams } from 'expo-router';
import { NotFound } from '../../../../components/NotFound';
import { useRecord } from '../../../../data/DataContext';
import { AnimalForm } from '../../../../features/herd/AnimalForm';

export default function EditAnimalScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const animal = useRecord('animal', id);
  return (
    <>
      <Stack.Screen options={{ title: 'Editar animal' }} />
      {animal ? <AnimalForm animal={animal} /> : <NotFound what="Animal" />}
    </>
  );
}

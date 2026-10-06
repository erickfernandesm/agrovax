import { Stack, useLocalSearchParams } from 'expo-router';
import { AnimalForm } from '../../../features/herd/AnimalForm';

export default function NewAnimalScreen() {
  const { lotId } = useLocalSearchParams<{ lotId?: string }>();
  return (
    <>
      <Stack.Screen options={{ title: 'Novo animal' }} />
      <AnimalForm initialLotId={lotId ?? null} />
    </>
  );
}

import { Stack } from 'expo-router';
import { LotForm } from '../../../features/herd/LotForm';

export default function NewLotScreen() {
  return (
    <>
      <Stack.Screen options={{ title: 'Novo lote' }} />
      <LotForm />
    </>
  );
}

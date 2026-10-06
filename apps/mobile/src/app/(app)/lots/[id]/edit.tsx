import { Stack, useLocalSearchParams } from 'expo-router';
import { NotFound } from '../../../../components/NotFound';
import { useRecord } from '../../../../data/DataContext';
import { LotForm } from '../../../../features/herd/LotForm';

export default function EditLotScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const lot = useRecord('lot', id);
  return (
    <>
      <Stack.Screen options={{ title: 'Editar lote' }} />
      {lot ? <LotForm lot={lot} /> : <NotFound what="Lote" />}
    </>
  );
}

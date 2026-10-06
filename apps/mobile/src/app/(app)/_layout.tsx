import { Redirect, Stack } from 'expo-router';
import { DataProvider } from '../../data/DataContext';
import { useAuth } from '../../features/auth/AuthContext';
import { colors } from '../../theme/tokens';

/**
 * Area autenticada. Sem sessao, qualquer rota daqui leva ao login.
 * O DataProvider abre o banco local da fazenda e mantem a sincronizacao.
 */
export default function AppLayout() {
  const { status } = useAuth();
  if (status !== 'signedIn') return <Redirect href="/login" />;

  return (
    <DataProvider>
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.primary },
          headerTintColor: colors.onPrimary,
          headerTitleStyle: { fontWeight: '700' },
          headerBackButtonDisplayMode: 'minimal',
          contentStyle: { backgroundColor: colors.background },
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      </Stack>
    </DataProvider>
  );
}

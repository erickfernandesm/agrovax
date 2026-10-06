import { Redirect, Stack } from 'expo-router';
import { useAuth } from '../../features/auth/AuthContext';
import { colors } from '../../theme/tokens';

/** Telas publicas. Quem ja esta autenticado e levado ao app. */
export default function AuthLayout() {
  const { status } = useAuth();
  if (status === 'signedIn') return <Redirect href="/" />;

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.background },
      }}
    />
  );
}

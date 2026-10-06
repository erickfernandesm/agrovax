import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Logo } from '../components/Logo';
import { AuthProvider, useAuth } from '../features/auth/AuthContext';
import { colors, spacing } from '../theme/tokens';

function RootNavigator() {
  const { status } = useAuth();

  // Enquanto a sessao salva e lida do aparelho, nenhuma rota e exibida.
  if (status === 'loading') {
    return (
      <View style={styles.loading}>
        <Logo />
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}>
      <Stack.Screen name="(app)" />
      <Stack.Screen name="(auth)" />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <StatusBar style="dark" />
        <RootNavigator />
      </AuthProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xxl,
    backgroundColor: colors.background,
  },
});

import { registerSchema } from '@agrovax/shared';
import { Link } from 'expo-router';
import { StyleSheet, Text } from 'react-native';
import { Button } from '../../components/Button';
import { Logo } from '../../components/Logo';
import { Notice } from '../../components/Notice';
import { Screen } from '../../components/Screen';
import { TextField } from '../../components/TextField';
import { useAuth } from '../../features/auth/AuthContext';
import { useConnectivity } from '../../hooks/useConnectivity';
import { useZodForm } from '../../hooks/useZodForm';
import { colors, spacing, typography } from '../../theme/tokens';

export default function RegisterScreen() {
  const { signUp } = useAuth();
  const { isOnline } = useConnectivity();
  const form = useZodForm(registerSchema, { name: '', email: '', password: '', farmName: '' });

  return (
    <Screen edges={['top', 'bottom', 'left', 'right']}>
      <Logo size="small" />
      <Text style={styles.title}>Criar conta</Text>
      <Text style={styles.subtitle}>
        Você cria sua conta e sua fazenda de uma vez. Depois disso o AgroVax funciona mesmo sem
        internet.
      </Text>

      {!isOnline ? (
        <Notice tone="warning" message="Sem internet. Para criar a conta é preciso estar conectado." />
      ) : null}
      {form.formError ? <Notice tone="error" message={form.formError} /> : null}

      <TextField
        label="Seu nome"
        value={form.values.name}
        onChangeText={(value) => form.setField('name', value)}
        error={form.errors.name}
        autoComplete="name"
        autoCapitalize="words"
      />
      <TextField
        label="Nome da fazenda"
        value={form.values.farmName}
        onChangeText={(value) => form.setField('farmName', value)}
        error={form.errors.farmName}
        autoCapitalize="words"
      />
      <TextField
        label="E-mail"
        value={form.values.email}
        onChangeText={(value) => form.setField('email', value)}
        error={form.errors.email}
        keyboardType="email-address"
        autoCapitalize="none"
        autoComplete="email"
        autoCorrect={false}
      />
      <TextField
        label="Senha"
        value={form.values.password}
        onChangeText={(value) => form.setField('password', value)}
        error={form.errors.password}
        hint="Pelo menos 8 caracteres."
        secureTextEntry
        autoComplete="new-password"
      />

      <Button
        label="Criar conta"
        loading={form.submitting}
        onPress={() => void form.submit(signUp)}
      />
      <Link href="/login" style={styles.link}>
        Já tenho conta
      </Link>
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { ...typography.title, color: colors.text },
  subtitle: { ...typography.body, color: colors.textMuted },
  link: {
    ...typography.bodyStrong,
    color: colors.primary,
    textAlign: 'center',
    paddingVertical: spacing.md,
  },
});

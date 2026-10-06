import { loginSchema } from '@agrovax/shared';
import { Link } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { Button } from '../../components/Button';
import { Logo } from '../../components/Logo';
import { Notice } from '../../components/Notice';
import { Screen } from '../../components/Screen';
import { TextField } from '../../components/TextField';
import { useAuth } from '../../features/auth/AuthContext';
import { useZodForm } from '../../hooks/useZodForm';
import { colors, spacing, typography } from '../../theme/tokens';

export default function LoginScreen() {
  const { signIn } = useAuth();
  const form = useZodForm(loginSchema, { email: '', password: '' });

  return (
    <Screen edges={['top', 'bottom', 'left', 'right']}>
      <View style={styles.header}>
        <Logo />
      </View>

      <Text style={styles.title}>Entrar</Text>
      {form.formError ? <Notice tone="error" message={form.formError} /> : null}

      <TextField
        label="E-mail"
        value={form.values.email}
        onChangeText={(value) => form.setField('email', value)}
        error={form.errors.email}
        keyboardType="email-address"
        autoCapitalize="none"
        autoComplete="email"
        autoCorrect={false}
        returnKeyType="next"
      />
      <TextField
        label="Senha"
        value={form.values.password}
        onChangeText={(value) => form.setField('password', value)}
        error={form.errors.password}
        secureTextEntry
        autoComplete="current-password"
        returnKeyType="go"
        onSubmitEditing={() => void form.submit(signIn)}
      />

      <Button label="Entrar" loading={form.submitting} onPress={() => void form.submit(signIn)} />

      <View style={styles.links}>
        <Link href="/forgot-password" style={styles.link}>
          Esqueci minha senha
        </Link>
        <Link href="/register" style={styles.link}>
          Criar conta
        </Link>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { paddingVertical: spacing.xxl },
  title: { ...typography.title, color: colors.text },
  links: { gap: spacing.sm, alignItems: 'center', marginTop: spacing.sm },
  link: { ...typography.bodyStrong, color: colors.primary, paddingVertical: spacing.md },
});

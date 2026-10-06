import { forgotPasswordSchema } from '@agrovax/shared';
import { Link, useRouter } from 'expo-router';
import { StyleSheet, Text } from 'react-native';
import { Button } from '../../components/Button';
import { Notice } from '../../components/Notice';
import { Screen } from '../../components/Screen';
import { TextField } from '../../components/TextField';
import { authService } from '../../features/auth/authService';
import { useZodForm } from '../../hooks/useZodForm';
import { colors, spacing, typography } from '../../theme/tokens';

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const form = useZodForm(forgotPasswordSchema, { email: '' });

  const send = () =>
    form.submit(async (data) => {
      await authService.requestPasswordReset(data);
      router.push({ pathname: '/reset-password', params: { email: data.email } });
    });

  return (
    <Screen edges={['top', 'bottom', 'left', 'right']}>
      <Text style={styles.title}>Recuperar senha</Text>
      <Text style={styles.subtitle}>
        Informe o e-mail da sua conta. Enviaremos um código de 6 dígitos para você criar uma nova
        senha.
      </Text>

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
      />

      <Button label="Enviar código" loading={form.submitting} onPress={() => void send()} />
      <Link href="/login" style={styles.link}>
        Voltar para o login
      </Link>
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { ...typography.title, color: colors.text, marginTop: spacing.xl },
  subtitle: { ...typography.body, color: colors.textMuted },
  link: {
    ...typography.bodyStrong,
    color: colors.primary,
    textAlign: 'center',
    paddingVertical: spacing.md,
  },
});

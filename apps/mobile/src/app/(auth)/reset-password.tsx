import { resetPasswordSchema } from '@agrovax/shared';
import { Link, useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import { Button } from '../../components/Button';
import { Notice } from '../../components/Notice';
import { Screen } from '../../components/Screen';
import { TextField } from '../../components/TextField';
import { authService } from '../../features/auth/authService';
import { useZodForm } from '../../hooks/useZodForm';
import { colors, spacing, typography } from '../../theme/tokens';

export default function ResetPasswordScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ email?: string }>();
  const [done, setDone] = useState(false);
  const form = useZodForm(resetPasswordSchema, {
    email: params.email ?? '',
    code: '',
    password: '',
  });

  const save = () =>
    form.submit(async (data) => {
      await authService.resetPassword(data);
      setDone(true);
    });

  if (done) {
    return (
      <Screen edges={['top', 'bottom', 'left', 'right']}>
        <Text style={styles.title}>Senha alterada</Text>
        <Notice tone="success" message="Sua nova senha já está valendo. Entre com ela." />
        <Button label="Ir para o login" onPress={() => router.replace('/login')} />
      </Screen>
    );
  }

  return (
    <Screen edges={['top', 'bottom', 'left', 'right']}>
      <Text style={styles.title}>Nova senha</Text>
      <Text style={styles.subtitle}>
        Se o e-mail estiver cadastrado, o código chega em instantes. Ele vale por 15 minutos.
      </Text>

      {form.formError ? <Notice tone="error" message={form.formError} /> : null}

      <TextField
        label="E-mail"
        value={form.values.email}
        onChangeText={(value) => form.setField('email', value)}
        error={form.errors.email}
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
      />
      <TextField
        label="Código de 6 dígitos"
        value={form.values.code}
        onChangeText={(value) => form.setField('code', value.replace(/\D/g, '').slice(0, 6))}
        error={form.errors.code}
        keyboardType="number-pad"
        autoComplete="one-time-code"
        maxLength={6}
      />
      <TextField
        label="Nova senha"
        value={form.values.password}
        onChangeText={(value) => form.setField('password', value)}
        error={form.errors.password}
        hint="Pelo menos 8 caracteres."
        secureTextEntry
        autoComplete="new-password"
      />

      <Button label="Salvar nova senha" loading={form.submitting} onPress={() => void save()} />
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

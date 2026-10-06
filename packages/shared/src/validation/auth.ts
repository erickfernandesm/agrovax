import { z } from 'zod';

const email = z
  .string()
  .trim()
  .toLowerCase()
  .max(254)
  .pipe(z.email('Informe um e-mail válido.'));

/** Senha: minimo de 8 caracteres; o limite superior respeita os 72 bytes do bcrypt. */
const password = z
  .string()
  .min(8, 'A senha deve ter pelo menos 8 caracteres.')
  .max(72, 'A senha deve ter no máximo 72 caracteres.');

const name = z.string().trim().min(2, 'Informe o nome.').max(120);

export const registerSchema = z.object({
  name,
  email,
  password,
  farmName: z.string().trim().min(2, 'Informe o nome da fazenda.').max(120),
});
export type RegisterInput = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  email,
  password: z.string().min(1, 'Informe a senha.').max(72),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const refreshSchema = z.object({
  refreshToken: z.string().min(20).max(200),
});
export type RefreshInput = z.infer<typeof refreshSchema>;

export const forgotPasswordSchema = z.object({ email });
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;

export const resetPasswordSchema = z.object({
  email,
  code: z
    .string()
    .trim()
    .regex(/^\d{6}$/, 'O código tem 6 dígitos.'),
  password,
});
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;

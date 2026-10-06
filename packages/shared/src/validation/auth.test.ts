import { describe, expect, it } from 'vitest';
import { loginSchema, registerSchema, resetPasswordSchema } from './auth';

describe('validacao de autenticacao', () => {
  it('normaliza o e-mail e aceita um cadastro valido', () => {
    const parsed = registerSchema.parse({
      name: '  Maria Silva ',
      email: '  Maria@Fazenda.COM ',
      password: 'senha-segura',
      farmName: 'Fazenda Boa Vista',
    });
    expect(parsed.email).toBe('maria@fazenda.com');
    expect(parsed.name).toBe('Maria Silva');
  });

  it('rejeita senha curta e e-mail invalido', () => {
    const result = registerSchema.safeParse({
      name: 'Maria',
      email: 'nao-e-email',
      password: '123',
      farmName: 'Fazenda',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const paths = result.error.issues.map((i) => i.path.join('.'));
      expect(paths).toContain('email');
      expect(paths).toContain('password');
    }
  });

  it('exige senha no login', () => {
    expect(loginSchema.safeParse({ email: 'a@b.com', password: '' }).success).toBe(false);
  });

  it('exige codigo de 6 digitos na redefinicao', () => {
    const base = { email: 'a@b.com', password: 'nova-senha-1' };
    expect(resetPasswordSchema.safeParse({ ...base, code: '12345' }).success).toBe(false);
    expect(resetPasswordSchema.safeParse({ ...base, code: 'abcdef' }).success).toBe(false);
    expect(resetPasswordSchema.safeParse({ ...base, code: '123456' }).success).toBe(true);
  });
});

import type {
  AuthResponse,
  AuthTokens,
  ForgotPasswordInput,
  LoginInput,
  MeResponse,
  RegisterInput,
  ResetPasswordInput,
  UserDto,
} from '@agrovax/shared';
import { Prisma, type PrismaClient, type User } from '@prisma/client';
import {
  generateResetCode,
  hashPassword,
  hashResetCode,
  safeEqualHex,
  verifyPassword,
} from '../../lib/crypto';
import { AppError, errors } from '../../lib/errors';
import type { Mailer } from '../../services/mailer';
import type { FarmService } from '../farms/farm.service';
import type { TokenService } from './token.service';

const RESET_CODE_TTL_MS = 15 * 60 * 1000;
const RESET_MAX_ATTEMPTS = 5;

/** Hash usado quando o e-mail nao existe, para o login levar o mesmo tempo. */
const DUMMY_HASH = '$2b$12$CwTycUXWue0Thq9StjUM0uJ8.qsYQkR0vY3z0G8f1qvM3yQyWwV8a';

function toUserDto(user: User): UserDto {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    isPlatformAdmin: user.isPlatformAdmin,
  };
}

export class AuthService {
  constructor(
    private readonly db: PrismaClient,
    private readonly tokens: TokenService,
    private readonly farms: FarmService,
    private readonly mailer: Mailer,
  ) {}

  /** Cria o usuario ja com a primeira fazenda e a assinatura gratuita. */
  async register(input: RegisterInput): Promise<AuthResponse> {
    const passwordHash = await hashPassword(input.password);

    let result: { user: User; tokens: AuthTokens };
    try {
      result = await this.db.$transaction(async (tx) => {
        const user = await tx.user.create({
          data: { name: input.name, email: input.email, passwordHash },
        });
        await this.farms.createForOwner(tx, user.id, { name: input.farmName });
        const tokens = await this.tokens.issue(user.id, tx);
        return { user, tokens };
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw errors.conflict('EMAIL_IN_USE', 'Já existe uma conta com este e-mail.');
      }
      throw error;
    }

    return {
      ...result.tokens,
      user: toUserDto(result.user),
      farms: await this.farms.listForUser(result.user.id),
    };
  }

  async login(input: LoginInput): Promise<AuthResponse> {
    const user = await this.db.user.findUnique({ where: { email: input.email } });
    const valid = await verifyPassword(input.password, user?.passwordHash ?? DUMMY_HASH);
    if (!user || !valid) throw errors.invalidCredentials();

    const tokens = await this.tokens.issue(user.id);
    return { ...tokens, user: toUserDto(user), farms: await this.farms.listForUser(user.id) };
  }

  async refresh(refreshToken: string): Promise<AuthTokens> {
    return (await this.tokens.rotate(refreshToken)).tokens;
  }

  async logout(refreshToken: string): Promise<void> {
    await this.tokens.revokeByToken(refreshToken);
  }

  async me(userId: string): Promise<MeResponse> {
    const user = await this.db.user.findUnique({ where: { id: userId } });
    if (!user) throw errors.unauthorized();
    return { user: toUserDto(user), farms: await this.farms.listForUser(userId) };
  }

  /**
   * Envia um codigo de 6 digitos por e-mail. Nao revela se o e-mail existe:
   * o chamador sempre recebe a mesma resposta.
   */
  async forgotPassword(input: ForgotPasswordInput): Promise<void> {
    const user = await this.db.user.findUnique({ where: { email: input.email } });
    if (!user) return;

    const code = generateResetCode();
    await this.db.$transaction([
      this.db.passwordResetToken.updateMany({
        where: { userId: user.id, usedAt: null },
        data: { usedAt: new Date() },
      }),
      this.db.passwordResetToken.create({
        data: {
          userId: user.id,
          codeHash: hashResetCode(user.id, code),
          expiresAt: new Date(Date.now() + RESET_CODE_TTL_MS),
        },
      }),
    ]);

    await this.mailer.send({
      to: user.email,
      subject: 'AgroVax - código para redefinir sua senha',
      text:
        `Olá, ${user.name}.\n\n` +
        `Seu código para redefinir a senha do AgroVax é: ${code}\n\n` +
        'Ele vale por 15 minutos. Se você não pediu a redefinição, ignore esta mensagem.',
    });
  }

  async resetPassword(input: ResetPasswordInput): Promise<void> {
    const invalid = new AppError(400, 'INVALID_RESET_CODE', 'Código inválido ou expirado.');

    const user = await this.db.user.findUnique({ where: { email: input.email } });
    if (!user) throw invalid;

    const token = await this.db.passwordResetToken.findFirst({
      where: { userId: user.id, usedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
    });
    if (!token || token.attempts >= RESET_MAX_ATTEMPTS) throw invalid;

    if (!safeEqualHex(token.codeHash, hashResetCode(user.id, input.code))) {
      await this.db.passwordResetToken.update({
        where: { id: token.id },
        data: { attempts: { increment: 1 } },
      });
      throw invalid;
    }

    const passwordHash = await hashPassword(input.password);
    await this.db.$transaction(async (tx) => {
      await tx.user.update({ where: { id: user.id }, data: { passwordHash } });
      await tx.passwordResetToken.update({ where: { id: token.id }, data: { usedAt: new Date() } });
      // Senha trocada: todas as sessoes abertas deixam de valer.
      await this.tokens.revokeAllForUser(user.id, tx);
    });
  }
}

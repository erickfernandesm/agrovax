import { createHash, createHmac, randomBytes, randomInt, timingSafeEqual } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { env } from '../config/env';

const BCRYPT_COST = env.NODE_ENV === 'test' ? 4 : 12;

export function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_COST);
}

export function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/** Token opaco de alta entropia (refresh token). */
export function generateOpaqueToken(): string {
  return randomBytes(48).toString('base64url');
}

/** Tokens de alta entropia podem ser guardados com hash simples (SHA-256). */
export function hashOpaqueToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/** Codigo numerico de 6 digitos para recuperacao de senha. */
export function generateResetCode(): string {
  return randomInt(0, 1_000_000).toString().padStart(6, '0');
}

/**
 * O codigo tem pouca entropia, entao o hash e um HMAC com o segredo do
 * servidor: sem o segredo, o banco sozinho nao permite descobrir o codigo.
 */
export function hashResetCode(userId: string, code: string): string {
  return createHmac('sha256', env.JWT_ACCESS_SECRET).update(`${userId}:${code}`).digest('hex');
}

export function safeEqualHex(a: string, b: string): boolean {
  const bufferA = Buffer.from(a, 'hex');
  const bufferB = Buffer.from(b, 'hex');
  return bufferA.length === bufferB.length && timingSafeEqual(bufferA, bufferB);
}

import * as Crypto from 'expo-crypto';

/** UUID v4 gerado no aparelho; e o id definitivo do registro, tambem no servidor. */
export function newId(): string {
  return Crypto.randomUUID();
}

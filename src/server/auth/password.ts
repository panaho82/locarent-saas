import { hash, verify } from "@node-rs/argon2";

/**
 * Hachage des mots de passe — Argon2id (recommandation OWASP 2024/2025).
 *
 * Paramètres : 19 MiB de mémoire, 2 passes, 1 thread.
 * On reste volontairement sous les 64 MiB pour qu'un VPS modeste puisse
 * encaisser plusieurs connexions simultanées sans saturer.
 */

/** Argon2id (const enum côté lib, donc valeur littérale ici pour isolatedModules). */
const ARGON2ID = 2;

const OPTIONS = {
  algorithm: ARGON2ID,
  memoryCost: 19_456, // 19 MiB
  timeCost: 2,
  parallelism: 1,
} as const;

export const PASSWORD_MIN_LENGTH = 10;

export function hashPassword(plain: string): Promise<string> {
  return hash(plain, OPTIONS);
}

/** Renvoie `false` au lieu de lever si le hash stocké est illisible. */
export async function verifyPassword(
  storedHash: string,
  plain: string,
): Promise<boolean> {
  try {
    return await verify(storedHash, plain, OPTIONS);
  } catch {
    return false;
  }
}

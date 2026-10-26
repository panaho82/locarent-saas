import { AsyncLocalStorage } from "node:async_hooks";

/**
 * Contexte d'agence — la brique qui rend l'isolation multi-tenant mécanique.
 *
 * Chaque requête authentifiée ouvre un contexte via `withTenant()`. Le client
 * Prisma étendu (`db`, voir src/server/db.ts) refuse toute requête sur une
 * table tenantée si aucun contexte n'est ouvert, et injecte `tenant_id` dans
 * les filtres quand il y en a un.
 *
 * Conséquence : oublier un `where` ne peut pas fuiter les données d'une autre
 * agence — au pire, la requête lève.
 *
 * ⚠️ Piège corrigé ici : les requêtes Prisma sont *paresseuses*. Écrire
 *
 *     runWithTenant(ctx, () => db.vehicle.findMany())   // ❌
 *
 * ne fonctionne pas : le contexte est refermé avant que le `await` du caller
 * ne déclenche réellement la requête. L'API est donc **asynchrone uniquement**
 * et fait l'`await` à l'intérieur du contexte :
 *
 *     await withTenant(ctx, () => db.vehicle.findMany())   // ✅
 */

export type TenantContext = {
  tenantId: number;
  /** id de la session courante, pour l'audit */
  sessionId?: number;
  userId?: number;
};

const storage = new AsyncLocalStorage<TenantContext>();

export class TenantContextError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TenantContextError";
  }
}

/**
 * Exécute `fn` dans le contexte d'une agence.
 *
 * L'`await` est fait ici, à l'intérieur du contexte : c'est ce qui permet aux
 * PrismaPromise paresseuses de s'exécuter avec le bon contexte.
 */
export async function withTenant<T>(
  tenantId: number,
  fn: () => PromiseLike<T>,
): Promise<T> {
  return storage.run({ tenantId }, async () => await fn());
}

/** Variante quand on dispose déjà d'un contexte complet (userId, sessionId). */
export async function withTenantContext<T>(
  context: TenantContext,
  fn: () => PromiseLike<T>,
): Promise<T> {
  return storage.run(context, async () => await fn());
}

/** Exécute `fn` hors de tout contexte (seed, tâches globales, tests). */
export function withoutTenant<T>(fn: () => T): T {
  return storage.exit(fn);
}

export function getTenantContext(): TenantContext | undefined {
  return storage.getStore();
}

export function getTenantId(): number | undefined {
  return storage.getStore()?.tenantId;
}

/**
 * À utiliser partout où une agence est indispensable : lève si le contexte
 * manque, plutôt que de renvoyer `undefined` et de laisser passer une requête
 * non filtrée.
 */
export function requireTenantId(): number {
  const context = storage.getStore();
  if (!context) {
    throw new TenantContextError(
      "Aucun contexte d'agence ouvert. Encapsuler l'accès aux données dans withTenant().",
    );
  }
  return context.tenantId;
}

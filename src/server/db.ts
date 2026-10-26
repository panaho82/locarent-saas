import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client";
import { requireTenantId, TenantContextError } from "./tenant-context";

/**
 * Accès aux données.
 *
 * Deux clients, et c'est volontaire :
 *
 *   `prisma` — client brut. Réservé au seed, aux scripts CLI et aux migrations.
 *              Il ne filtre rien : ne jamais l'importer dans le code applicatif.
 *
 *   `db`     — client étendu. C'est celui qu'utilise l'application. Il injecte
 *              `tenant_id` dans toutes les opérations des tables tenantées et
 *              lève si aucun contexte d'agence n'est ouvert.
 *
 * En Prisma 7, le client est généré dans src/generated/prisma et exige un
 * driver adapter : plus de moteur Rust, plus d'import depuis @prisma/client.
 */

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error(
    "DATABASE_URL manquante : copier .env.example en .env à la racine du projet.",
  );
}

const adapter = new PrismaPg({ connectionString });

const globalForPrisma = globalThis as unknown as {
  prismaBase?: PrismaClient;
};

const prismaBase =
  globalForPrisma.prismaBase ??
  new PrismaClient({
    adapter,
    log:
      process.env.NODE_ENV === "development"
        ? [{ emit: "stdout", level: "warn" }, { emit: "stdout", level: "error" }]
        : [{ emit: "stdout", level: "error" }],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prismaBase = prismaBase;
}

// -----------------------------------------------------------------------------
//  Périmètre des modèles
// -----------------------------------------------------------------------------

/**
 * Modèles portant une colonne `tenant_id` : le filtre est injecté
 * automatiquement sur TOUTES leurs opérations.
 *
 * Les tables filles sans `tenant_id` (booking_extras, invoice_lines, contracts,
 * vehicle_images, inspection_photos, …) ne sont volontairement pas listées :
 * elles s'atteignent via leur parent (`include`), qui est filtré. Une requête
 * de premier niveau sur ces tables contourne la garde — c'est documenté dans
 * AGENTS.md.
 */
const TENANT_SCOPED_MODELS = new Set<string>([
  "Subscription",
  "User",
  "Invitation",
  "MobileDevice",
  "Session",
  "Settings",
  "VehicleCategory",
  "Location",
  "ExtraService",
  "Vehicle",
  "Maintenance",
  "Customer",
  "Driver",
  "Company",
  "Document",
  "Booking",
  "Inspection",
  "Invoice",
  "Estimate",
  "Payment",
  "Expense",
  "PromoCode",
  "Notification",
  "ActivityLog",
]);

/** Opérations filtrées par un `where`. */
const WHERE_OPERATIONS = new Set([
  "findUnique",
  "findUniqueOrThrow",
  "findFirst",
  "findFirstOrThrow",
  "findMany",
  "count",
  "aggregate",
  "groupBy",
  "update",
  "updateMany",
  "updateManyAndReturn",
  "delete",
  "deleteMany",
  "upsert",
]);

/** Opérations d'écriture dont les données doivent porter le tenant. */
const CREATE_OPERATIONS = new Set([
  "create",
  "createMany",
  "createManyAndReturn",
]);

type Args = Record<string, unknown> & {
  where?: Record<string, unknown>;
  data?: Record<string, unknown> | Record<string, unknown>[];
  create?: Record<string, unknown>;
};

/**
 * Injecte `tenantId` dans les arguments d'une opération.
 *
 * Échoue volontairement (plutôt que de corriger silencieusement) si le code
 * appelant prétend écrire dans une autre agence : c'est le signe d'un bug ou
 * d'une tentative de contournement.
 */
function scopeArgs(
  model: string,
  operation: string,
  args: Args | undefined,
  tenantId: number,
): Args {
  const scoped: Args = { ...(args ?? {}) };

  const assertSameTenant = (candidate: unknown, context: string) => {
    if (candidate !== undefined && candidate !== tenantId) {
      throw new TenantContextError(
        `${model}.${operation} : ${context} cible l'agence ${String(
          candidate,
        )} alors que le contexte est l'agence ${tenantId}.`,
      );
    }
  };

  if (WHERE_OPERATIONS.has(operation)) {
    const where = { ...(scoped.where ?? {}) };
    assertSameTenant(where.tenantId, "le where");
    where.tenantId = tenantId;
    scoped.where = where;
  }

  if (CREATE_OPERATIONS.has(operation)) {
    if (Array.isArray(scoped.data)) {
      scoped.data = scoped.data.map((row) => {
        assertSameTenant(row.tenantId, "une ligne de data");
        return { ...row, tenantId };
      });
    } else {
      const data = { ...(scoped.data ?? {}) };
      assertSameTenant(data.tenantId, "la data");
      data.tenantId = tenantId;
      scoped.data = data;
    }
  }

  if (operation === "upsert" && scoped.create) {
    const create = { ...scoped.create };
    assertSameTenant(create.tenantId, "la branche create");
    create.tenantId = tenantId;
    scoped.create = create;
  }

  return scoped;
}

// -----------------------------------------------------------------------------
//  Clients exportés
// -----------------------------------------------------------------------------

/** Client brut — seed, scripts, tests de la couche basse. */
export const prisma = prismaBase;

/**
 * Client applicatif, tenant-scoped.
 *
 *   import { db } from "@/server/db";
 *   const vehicles = await db.vehicle.findMany(); // filtré sur l'agence courante
 */
export const db = prismaBase.$extends({
  name: "tenant-isolation",
  query: {
    $allModels: {
      async $allOperations({ model, operation, args, query }) {
        if (!TENANT_SCOPED_MODELS.has(model)) {
          return query(args);
        }

        // Lève TenantContextError si aucun contexte n'est ouvert.
        const tenantId = requireTenantId();

        return query(scopeArgs(model, operation, args as Args, tenantId));
      },
    },
  },
});

export type TenantDb = typeof db;
export type { PrismaClient };

import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db, prisma } from "@/server/db";
import {
  requireTenantId,
  withTenant,
  TenantContextError,
} from "@/server/tenant-context";

/**
 * Le test qui compte du Lot 0.
 *
 * Il ne vérifie pas « que le code filtre bien » : il vérifie que la couche de
 * données *refuse* de travailler sans contexte d'agence. Si quelqu'un retire
 * l'extension Prisma, ces tests tombent.
 */

const suffix = randomUUID().slice(0, 8);

type Fixture = {
  tenantId: number;
  vehicleId: number;
  customerId: number;
};

let agenceA: Fixture;
let agenceB: Fixture;

async function createTenant(label: string): Promise<Fixture> {
  const tenant = await prisma.tenant.create({
    data: {
      slug: `test-${label}-${suffix}`,
      name: `Test ${label}`,
      email: `contact-${label}-${suffix}@locarent.test`,
      country: "PF",
    },
  });

  const vehicle = await prisma.vehicle.create({
    data: {
      tenantId: tenant.id,
      name: `Véhicule ${label}`,
      licensePlate: `TEST${label.toUpperCase()}${suffix.slice(0, 4)}`,
      dailyRate: 5500,
    },
  });

  const customer = await prisma.customer.create({
    data: {
      tenantId: tenant.id,
      type: "private",
      firstName: "Client",
      lastName: label,
      email: `client-${label}-${suffix}@locarent.test`,
    },
  });

  return {
    tenantId: tenant.id,
    vehicleId: vehicle.id,
    customerId: customer.id,
  };
}

beforeAll(async () => {
  agenceA = await createTenant("a");
  agenceB = await createTenant("b");
});

afterAll(async () => {
  // Les cascades nettoient véhicules, clients et sessions.
  await prisma.tenant.deleteMany({
    where: { id: { in: [agenceA.tenantId, agenceB.tenantId] } },
  });
  await prisma.$disconnect();
});

describe("isolation multi-tenant", () => {
  it("refuse toute lecture d'une table tenantée sans contexte d'agence", async () => {
    await expect(db.vehicle.findMany()).rejects.toBeInstanceOf(
      TenantContextError,
    );
    await expect(db.customer.count()).rejects.toBeInstanceOf(
      TenantContextError,
    );
    await expect(
      db.booking.findMany({ where: { status: "pending" } }),
    ).rejects.toThrow(/contexte/i);
  });

  it("ne renvoie que les lignes de l'agence courante", async () => {
    const vehicles = await withTenant(agenceA.tenantId, () =>
      db.vehicle.findMany({ orderBy: { id: "asc" } }),
    );

    const ids = vehicles.map((v) => v.id);
    expect(ids).toContain(agenceA.vehicleId);
    expect(ids).not.toContain(agenceB.vehicleId);
    expect(vehicles.every((v) => v.tenantId === agenceA.tenantId)).toBe(true);
  });

  it("renvoie null sur une lecture par id appartenant à une autre agence", async () => {
    const forbidden = await withTenant(agenceA.tenantId, () =>
      db.vehicle.findUnique({ where: { id: agenceB.vehicleId } }),
    );

    expect(forbidden).toBeNull();

    const allowed = await withTenant(agenceA.tenantId, () =>
      db.vehicle.findUnique({ where: { id: agenceA.vehicleId } }),
    );
    expect(allowed?.id).toBe(agenceA.vehicleId);
  });

  it("n'écrit pas dans une autre agence via update ni delete", async () => {
    const updated = await withTenant(agenceA.tenantId, () =>
      db.vehicle.updateMany({
        where: { id: agenceB.vehicleId },
        data: { mileage: 999_999 },
      }),
    );
    expect(updated.count).toBe(0);

    const deleted = await withTenant(agenceA.tenantId, () =>
      db.vehicle.deleteMany({ where: { id: agenceB.vehicleId } }),
    );
    expect(deleted.count).toBe(0);

    // La ligne de B est intacte.
    const intact = await prisma.vehicle.findUniqueOrThrow({
      where: { id: agenceB.vehicleId },
    });
    expect(intact.mileage).toBe(0);
  });

  it("persiste le tenant fourni à la création et l'accepte s'il correspond au contexte", async () => {
    // `tenantId` est requis par le type Prisma (choix assumé : visible en revue)
    // et revérifié à l'exécution par l'extension (refus si autre agence).
    const created = await withTenant(agenceA.tenantId, () =>
      db.customer.create({
        data: {
          tenantId: requireTenantId(),
          type: "private",
          firstName: "Sans",
          lastName: "Tenant",
        },
      }),
    );

    expect(created.tenantId).toBe(agenceA.tenantId);

    // Nettoyage de la ligne créée par ce test.
    await prisma.customer.delete({ where: { id: created.id } });
  });

  it("refuse explicitement une création visant une autre agence", async () => {
    await expect(
      withTenant(agenceA.tenantId, () =>
        db.customer.create({
          data: {
            tenantId: agenceB.tenantId,
            type: "private",
            firstName: "Intrus",
            lastName: "Test",
          },
        }),
      ),
    ).rejects.toBeInstanceOf(TenantContextError);
  });

  it("laisse les référentiels globaux accessibles hors contexte", async () => {
    // Fixture propre : ce test ne doit pas dépendre du seed (la CI de qualité
    // ne sème pas, elle vérifie que le dépôt tient tout seul).
    const brand = await prisma.brand.create({
      data: { name: `Marque ${suffix}`, slug: `marque-test-${suffix}` },
    });

    try {
      const found = await db.brand.findUnique({ where: { slug: brand.slug } });
      expect(found?.id).toBe(brand.id);
      // Les référentiels globaux restent lisibles sans contexte d'agence.
      await expect(db.plan.findMany()).resolves.toBeInstanceOf(Array);
      await expect(db.color.count()).resolves.toBeGreaterThanOrEqual(0);
    } finally {
      await prisma.brand.delete({ where: { id: brand.id } });
    }
  });

  it("le client brut (`prisma`) n'est pas filtré — c'est pourquoi il est réservé au CLI", async () => {
    const all = await prisma.vehicle.findMany({
      where: { id: { in: [agenceA.vehicleId, agenceB.vehicleId] } },
    });
    expect(all).toHaveLength(2);
  });
});

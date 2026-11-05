"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/server/auth/session-context";
import { logActivity } from "@/server/audit";
import { db } from "@/server/db";
import { requireTenantId, withTenant } from "@/server/tenant-context";
/**
 * Jeu de données de démonstration pour une agence.
 *
 * Utile pendant l'essai : une agence qui découvre le produit voit un parc
 * réaliste plutôt qu'un écran vide. Réservé au propriétaire, idempotent
 * (n'ajoute que ce qui manque), et sans effet sur les données existantes.
 */

const CATEGORIES = ["Auto", "Scooter", "Utilitaire"];

const LOCATION = {
  name: "Agence principale",
  address: "Quai des Pêcheurs",
  island: "Raiatea",
};

const EXTRAS = [
  { name: "GPS", description: "Navigation GPS portable", price: 1500, priceType: "per_day" as const },
  { name: "Siège enfant", description: "Siège auto pour enfant", price: 1000, priceType: "per_rental" as const },
  { name: "Assurance tous risques", description: "Franchise réduite à zéro", price: 2500, priceType: "per_day" as const },
];

const VEHICLES = [
  { name: "Renault Kwid", model: "KWID", plate: "276 969 P", year: 2026, seats: 4, fuel: "petrol", gearbox: "manual", rate: 6630 },
  { name: "Dacia Sandero", model: "Sandero", plate: "845 120 P", year: 2025, seats: 5, fuel: "petrol", gearbox: "manual", rate: 7900 },
  { name: "Suzuki Jimny", model: "Jimny", plate: "312 447 P", year: 2024, seats: 4, fuel: "petrol", gearbox: "manual", rate: 9500 },
  { name: "Toyota Hilux", model: "Hilux", plate: "907 233 P", year: 2025, seats: 5, fuel: "diesel", gearbox: "automatic", rate: 13_500 },
] as const;

export async function loadDemoDataAction(): Promise<void> {
  const session = await requireSession();

  if (session.role !== "owner") return;

  const created = await withTenant(session.tenantId, async () => {
    const tenantId = requireTenantId();

    for (const name of CATEGORIES) {
      const exists = await db.vehicleCategory.findFirst({ where: { name }, select: { id: true } });
      if (!exists) await db.vehicleCategory.create({ data: { tenantId, name } });
    }

    let location = await db.location.findFirst({ select: { id: true } });
    if (!location) {
      location = await db.location.create({
        data: { tenantId, ...LOCATION, isDefault: true, isPublic: true, isFree: true },
        select: { id: true },
      });
    }

    const auto = await db.vehicleCategory.findFirst({
      where: { name: "Auto" },
      select: { id: true },
    });

    let added = 0;
    for (const vehicle of VEHICLES) {
      const exists = await db.vehicle.findFirst({
        where: { licensePlate: vehicle.plate },
        select: { id: true },
      });
      if (exists) continue;

      await db.vehicle.create({
        data: {
          tenantId,
          name: vehicle.name,
          licensePlate: vehicle.plate,
          model: vehicle.model,
          year: vehicle.year,
          seats: vehicle.seats,
          fuelType: vehicle.fuel,
          transmissionType: vehicle.gearbox,
          mileage: 12_000,
          status: "available",
          dailyRate: vehicle.rate,
          weeklyRate: vehicle.rate * 6,
          monthlyRate: vehicle.rate * 21,
          categoryId: auto?.id ?? null,
          mainLocationId: location.id,
        },
      });
      added += 1;
    }

    for (const extra of EXTRAS) {
      const exists = await db.extraService.findFirst({
        where: { name: extra.name },
        select: { id: true },
      });
      if (!exists) {
        await db.extraService.create({
          data: { tenantId, ...extra, isActive: true },
        });
      }
    }

    return added;
  });

  await logActivity({
    tenantId: session.tenantId,
    userId: session.userId,
    action: "demo.data.loaded",
    subjectType: "tenant",
    subjectId: session.tenantId,
    properties: { vehicles: created },
  });

  revalidatePath("/admin/cars");
  revalidatePath("/admin/locations");
  revalidatePath("/admin/extra-services");
  revalidatePath("/admin/index");

}


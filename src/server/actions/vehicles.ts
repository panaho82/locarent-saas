"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { can } from "@/server/auth/permissions";
import { requireSession } from "@/server/auth/session-context";
import { logActivity } from "@/server/audit";
import { db } from "@/server/db";
import { requireTenantId, withTenant } from "@/server/tenant-context";
import { fieldErrors, vehicleSchema } from "@/lib/validation/vehicle";
import type { ActionState } from "./types";

/**
 * Parc automobile — création, modification, suppression.
 *
 * Toute action revérifie la permission côté serveur : l'interface masque les
 * boutons, elle ne protège rien.
 */

function parseForm(formData: FormData) {
  return vehicleSchema.safeParse({
    name: formData.get("name"),
    make: formData.get("make"),
    brandId: formData.get("brandId"),
    model: formData.get("model"),
    licensePlate: formData.get("licensePlate"),
    categoryId: formData.get("categoryId"),
    colorSlug: formData.get("colorSlug"),
    year: formData.get("year"),
    mileage: formData.get("mileage"),
    seats: formData.get("seats"),
    fuelType: formData.get("fuelType"),
    transmissionType: formData.get("transmissionType"),
    nextTechnicalControlDate: formData.get("nextTechnicalControlDate"),
    mainLocationId: formData.get("mainLocationId"),
    dailyRate: formData.get("dailyRate"),
    weeklyRate: formData.get("weeklyRate"),
    monthlyRate: formData.get("monthlyRate"),
    baseKilometers: formData.get("baseKilometers"),
    extraKmPrice: formData.get("extraKmPrice"),
    isUnlimitedKilometers: formData.get("isUnlimitedKilometers"),
  });
}

type ParsedVehicle = NonNullable<ReturnType<typeof parseForm>["data"]>;

function toData(data: ParsedVehicle) {
  return {
    name: data.name,
    make: data.make,
    brandId: data.brandId,
    model: data.model,
    licensePlate: data.licensePlate,
    categoryId: data.categoryId,
    colorSlug: data.colorSlug,
    year: data.year,
    mileage: data.mileage ?? 0,
    seats: data.seats,
    fuelType: data.fuelType as never,
    transmissionType: data.transmissionType as never,
    nextTechnicalControlDate: data.nextTechnicalControlDate
      ? new Date(`${data.nextTechnicalControlDate}T00:00:00Z`)
      : null,
    mainLocationId: data.mainLocationId,
    dailyRate: data.dailyRate,
    weeklyRate: data.weeklyRate,
    monthlyRate: data.monthlyRate,
    // Le tarif illimité en km n'a de sens que sans forfait kilométrique.
    baseKilometers: data.isUnlimitedKilometers ? null : data.baseKilometers,
    extraKmPrice: data.isUnlimitedKilometers ? null : data.extraKmPrice,
  };
}

export async function createVehicleAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await requireSession();
  if (!can(session, "vehicle.create")) {
    return { status: "error", message: "Votre rôle ne permet pas d'ajouter un véhicule." };
  }

  const parsed = parseForm(formData);
  if (!parsed.success) {
    return { status: "error", fieldErrors: fieldErrors(parsed.error) };
  }

  const payload = toData(parsed.data);

  let vehicleId: number;
  try {
    const vehicle = await withTenant(session.tenantId, () =>
      db.vehicle.create({
        data: { tenantId: requireTenantId(), ...payload },
        select: { id: true },
      }),
    );
    vehicleId = vehicle.id;
  } catch (error) {
    if ((error as { code?: string }).code === "P2002") {
      return {
        status: "error",
        fieldErrors: { licensePlate: ["Cette immatriculation existe déjà dans votre parc."] },
      };
    }
    console.error("createVehicleAction", error);
    return { status: "error", message: "Impossible d'enregistrer le véhicule." };
  }

  await logActivity({
    tenantId: session.tenantId,
    userId: session.userId,
    action: "vehicle.created",
    subjectType: "vehicle",
    subjectId: vehicleId,
    properties: { name: parsed.data.name, plate: parsed.data.licensePlate },
  });

  revalidatePath("/admin/cars");
  redirect(`/admin/cars/${vehicleId}`);
}

export async function updateVehicleAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await requireSession();
  if (!can(session, "vehicle.edit")) {
    return { status: "error", message: "Votre rôle ne permet pas de modifier un véhicule." };
  }

  const id = Number(formData.get("vehicleId"));
  if (!Number.isInteger(id) || id <= 0) {
    return { status: "error", message: "Véhicule introuvable." };
  }

  const parsed = parseForm(formData);
  if (!parsed.success) {
    return { status: "error", fieldErrors: fieldErrors(parsed.error) };
  }

  try {
    // `updateMany` porte le filtre tenant : un id d'une autre agence ne touche
    // aucune ligne, ce qu'un `update` par id seul ne garantirait pas.
    const result = await withTenant(session.tenantId, () =>
      db.vehicle.updateMany({ where: { id }, data: toData(parsed.data) }),
    );
    if (result.count === 0) {
      return { status: "error", message: "Véhicule introuvable." };
    }
  } catch (error) {
    if ((error as { code?: string }).code === "P2002") {
      return {
        status: "error",
        fieldErrors: { licensePlate: ["Cette immatriculation existe déjà dans votre parc."] },
      };
    }
    console.error("updateVehicleAction", error);
    return { status: "error", message: "Impossible d'enregistrer les modifications." };
  }

  await logActivity({
    tenantId: session.tenantId,
    userId: session.userId,
    action: "vehicle.updated",
    subjectType: "vehicle",
    subjectId: id,
    properties: { name: parsed.data.name },
  });

  revalidatePath("/admin/cars");
  revalidatePath(`/admin/cars/${id}`);
  return { status: "success", message: "Véhicule mis à jour." };
}

export async function deleteVehicleAction(formData: FormData): Promise<void> {
  const session = await requireSession();
  if (!can(session, "vehicle.delete")) return;

  const id = Number(formData.get("vehicleId"));
  if (!Number.isInteger(id) || id <= 0) return;

  const used = await withTenant(session.tenantId, () =>
    db.booking.count({ where: { vehicleId: id } }),
  );

  if (used > 0) {
    // Un véhicule qui a roulé ne se supprime pas : l'historique et les
    // contrats y font référence. On le désactive.
    await withTenant(session.tenantId, () =>
      db.vehicle.updateMany({ where: { id }, data: { isActive: false, status: "inactive" } }),
    );
    await logActivity({
      tenantId: session.tenantId,
      userId: session.userId,
      action: "vehicle.deactivated",
      subjectType: "vehicle",
      subjectId: id,
      properties: { reason: "véhicule utilisé par des réservations" },
    });
  } else {
    await withTenant(session.tenantId, () => db.vehicle.deleteMany({ where: { id } }));
    await logActivity({
      tenantId: session.tenantId,
      userId: session.userId,
      action: "vehicle.deleted",
      subjectType: "vehicle",
      subjectId: id,
    });
  }

  revalidatePath("/admin/cars");
  redirect("/admin/cars");
}

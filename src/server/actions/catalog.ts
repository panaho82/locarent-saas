"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { can } from "@/server/auth/permissions";
import { requireSession } from "@/server/auth/session-context";
import { logActivity } from "@/server/audit";
import { db } from "@/server/db";
import { requireTenantId, withTenant } from "@/server/tenant-context";
import {
  extraServiceSchema,
  fieldErrors,
  locationSchema,
} from "@/lib/validation/catalog";
import type { ActionState } from "./types";

/**
 * Catalogue de l'agence : emplacements et services supplémentaires.
 *
 * Les lectures passent par le client tenant-scoped ; les écritures utilisent
 * `updateMany`/`deleteMany` pour que le filtre d'agence soit toujours appliqué.
 */

// --- Emplacements ------------------------------------------------------------

export async function createLocationAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await requireSession();
  if (!can(session, "settings.edit")) {
    return { status: "error", message: "Votre rôle ne permet pas de modifier les emplacements." };
  }

  const parsed = locationSchema.safeParse({
    name: formData.get("name"),
    address: formData.get("address"),
    island: formData.get("island"),
    openingHours: formData.get("openingHours"),
    price: formData.get("price"),
    isFree: formData.get("isFree"),
    isPublic: formData.get("isPublic"),
    isDefault: formData.get("isDefault"),
  });
  if (!parsed.success) return { status: "error", fieldErrors: fieldErrors(parsed.error) };

  const d = parsed.data;
  await withTenant(session.tenantId, async () => {
    // Un seul emplacement par défaut à la fois.
    if (d.isDefault) {
      await db.location.updateMany({ where: { isDefault: true }, data: { isDefault: false } });
    }
    await db.location.create({
      data: {
        tenantId: requireTenantId(),
        name: d.name,
        address: d.address,
        island: d.island,
        openingHours: d.openingHours,
        price: d.isFree ? null : d.price,
        isFree: d.isFree,
        isPublic: d.isPublic,
        isDefault: d.isDefault,
      },
    });
  });

  await logActivity({
    tenantId: session.tenantId,
    userId: session.userId,
    action: "location.created",
    subjectType: "location",
    properties: { name: d.name },
  });

  revalidatePath("/admin/locations");
  redirect("/admin/locations");
}

export async function updateLocationAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await requireSession();
  if (!can(session, "settings.edit")) {
    return { status: "error", message: "Votre rôle ne permet pas de modifier les emplacements." };
  }

  const id = Number(formData.get("locationId"));
  if (!Number.isInteger(id) || id <= 0) return { status: "error", message: "Emplacement introuvable." };

  const parsed = locationSchema.safeParse({
    name: formData.get("name"),
    address: formData.get("address"),
    island: formData.get("island"),
    openingHours: formData.get("openingHours"),
    price: formData.get("price"),
    isFree: formData.get("isFree"),
    isPublic: formData.get("isPublic"),
    isDefault: formData.get("isDefault"),
  });
  if (!parsed.success) return { status: "error", fieldErrors: fieldErrors(parsed.error) };

  const d = parsed.data;
  const updated = await withTenant(session.tenantId, async () => {
    if (d.isDefault) {
      await db.location.updateMany({
        where: { isDefault: true, id: { not: id } },
        data: { isDefault: false },
      });
    }
    const result = await db.location.updateMany({
      where: { id },
      data: {
        name: d.name,
        address: d.address,
        island: d.island,
        openingHours: d.openingHours,
        price: d.isFree ? null : d.price,
        isFree: d.isFree,
        isPublic: d.isPublic,
        isDefault: d.isDefault,
      },
    });
    return result.count;
  });

  if (updated === 0) return { status: "error", message: "Emplacement introuvable." };

  await logActivity({
    tenantId: session.tenantId,
    userId: session.userId,
    action: "location.updated",
    subjectType: "location",
    subjectId: id,
    properties: { name: d.name },
  });

  revalidatePath("/admin/locations");
  return { status: "success", message: "Emplacement enregistré." };
}

export async function deleteLocationAction(formData: FormData): Promise<void> {
  const session = await requireSession();
  if (!can(session, "settings.edit")) return;

  const id = Number(formData.get("locationId"));
  if (!Number.isInteger(id) || id <= 0) return;

  await withTenant(session.tenantId, async () => {
    // Les véhicules et réservations y font référence : on refuse la suppression
    // plutôt que de casser l'historique (les FK sont en SET NULL, mais un
    // emplacement disparu rendrait les fiches incompréhensibles).
    const used = await db.vehicle.count({ where: { mainLocationId: id } });
    if (used > 0) return;
    await db.location.deleteMany({ where: { id } });
  });

  await logActivity({
    tenantId: session.tenantId,
    userId: session.userId,
    action: "location.deleted",
    subjectType: "location",
    subjectId: id,
  });

  revalidatePath("/admin/locations");
  redirect("/admin/locations");
}

// --- Services supplémentaires ------------------------------------------------

export async function createExtraServiceAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await requireSession();
  if (!can(session, "vehicle.edit")) {
    return { status: "error", message: "Votre rôle ne permet pas de modifier les services." };
  }

  const parsed = extraServiceSchema.safeParse({
    name: formData.get("name"),
    description: formData.get("description"),
    price: formData.get("price"),
    priceType: formData.get("priceType"),
    maxQty: formData.get("maxQty"),
    isActive: formData.get("isActive"),
  });
  if (!parsed.success) return { status: "error", fieldErrors: fieldErrors(parsed.error) };

  const d = parsed.data;
  await withTenant(session.tenantId, () =>
    db.extraService.create({
      data: {
        tenantId: requireTenantId(),
        name: d.name,
        description: d.description,
        price: d.price,
        priceType: d.priceType,
        maxQty: d.maxQty,
        isActive: d.isActive,
      },
    }),
  );

  await logActivity({
    tenantId: session.tenantId,
    userId: session.userId,
    action: "extra.created",
    subjectType: "extra_service",
    properties: { name: d.name, price: d.price },
  });

  revalidatePath("/admin/extra-services");
  redirect("/admin/extra-services");
}

export async function updateExtraServiceAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await requireSession();
  if (!can(session, "vehicle.edit")) {
    return { status: "error", message: "Votre rôle ne permet pas de modifier les services." };
  }

  const id = Number(formData.get("extraServiceId"));
  if (!Number.isInteger(id) || id <= 0) return { status: "error", message: "Service introuvable." };

  const parsed = extraServiceSchema.safeParse({
    name: formData.get("name"),
    description: formData.get("description"),
    price: formData.get("price"),
    priceType: formData.get("priceType"),
    maxQty: formData.get("maxQty"),
    isActive: formData.get("isActive"),
  });
  if (!parsed.success) return { status: "error", fieldErrors: fieldErrors(parsed.error) };

  const d = parsed.data;
  const updated = await withTenant(session.tenantId, async () => {
    const result = await db.extraService.updateMany({
      where: { id },
      data: {
        name: d.name,
        description: d.description,
        price: d.price,
        priceType: d.priceType,
        maxQty: d.maxQty,
        isActive: d.isActive,
      },
    });
    return result.count;
  });

  if (updated === 0) return { status: "error", message: "Service introuvable." };

  await logActivity({
    tenantId: session.tenantId,
    userId: session.userId,
    action: "extra.updated",
    subjectType: "extra_service",
    subjectId: id,
    properties: { name: d.name },
  });

  revalidatePath("/admin/extra-services");
  return { status: "success", message: "Service enregistré." };
}

export async function deleteExtraServiceAction(formData: FormData): Promise<void> {
  const session = await requireSession();
  if (!can(session, "vehicle.edit")) return;

  const id = Number(formData.get("extraServiceId"));
  if (!Number.isInteger(id) || id <= 0) return;

  await withTenant(session.tenantId, () => db.extraService.deleteMany({ where: { id } }));

  await logActivity({
    tenantId: session.tenantId,
    userId: session.userId,
    action: "extra.deleted",
    subjectType: "extra_service",
    subjectId: id,
  });

  revalidatePath("/admin/extra-services");
  redirect("/admin/extra-services");
}

/** Création rapide d'une catégorie de véhicule, depuis le formulaire véhicule. */
export async function createCategoryAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await requireSession();
  if (!can(session, "vehicle.edit")) {
    return { status: "error", message: "Votre rôle ne permet pas de créer une catégorie." };
  }

  const name = String(formData.get("categoryName") ?? "").trim();
  const parsed = z.string().min(2, "Nom trop court").max(80, "Nom trop long").safeParse(name);
  if (!parsed.success) {
    return { status: "error", fieldErrors: { categoryName: [parsed.error.issues[0].message] } };
  }

  const exists = await withTenant(session.tenantId, () =>
    db.vehicleCategory.findFirst({ where: { name: parsed.data }, select: { id: true } }),
  );
  if (exists) return { status: "error", message: "Cette catégorie existe déjà." };

  await withTenant(session.tenantId, () =>
    db.vehicleCategory.create({ data: { tenantId: requireTenantId(), name: parsed.data } }),
  );

  revalidatePath("/admin/cars/new");
  return { status: "success", message: `Catégorie « ${parsed.data} » créée.` };
}

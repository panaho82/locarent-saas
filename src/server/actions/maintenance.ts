"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { can } from "@/server/auth/permissions";
import { requireSession } from "@/server/auth/session-context";
import { logActivity } from "@/server/audit";
import { db } from "@/server/db";
import { requireTenantId, withTenant } from "@/server/tenant-context";
import { fieldErrors, maintenanceSchema } from "@/lib/validation/maintenance";
import type { ActionState } from "./types";

/**
 * Maintenance du parc.
 *
 * Une intervention passée en « Terminé » met à jour le kilométrage du véhicule
 * et, pour un contrôle technique, sa date de prochain contrôle : c'est la
 * donnée qui alimente les alertes du tableau de bord.
 */

const date = (value: string | null) =>
  value === null ? null : new Date(`${value}T00:00:00Z`);

function parseForm(formData: FormData) {
  return maintenanceSchema.safeParse({
    vehicleId: formData.get("vehicleId"),
    type: formData.get("type"),
    status: formData.get("status"),
    title: formData.get("title"),
    description: formData.get("description"),
    cost: formData.get("cost"),
    mileage: formData.get("mileage"),
    performedAt: formData.get("performedAt"),
    nextDueDate: formData.get("nextDueDate"),
    nextDueMileage: formData.get("nextDueMileage"),
    garage: formData.get("garage"),
  });
}

export async function createMaintenanceAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await requireSession();
  if (!can(session, "maintenance.create")) {
    return { status: "error", message: "Votre rôle ne permet pas d'ajouter une intervention." };
  }

  const parsed = parseForm(formData);
  if (!parsed.success) return { status: "error", fieldErrors: fieldErrors(parsed.error) };
  const d = parsed.data;

  const created = await withTenant(session.tenantId, async () => {
    const vehicle = await db.vehicle.findFirst({
      where: { id: d.vehicleId },
      select: { id: true },
    });
    if (!vehicle) return null;

    const record = await db.maintenance.create({
      data: {
        tenantId: requireTenantId(),
        vehicleId: d.vehicleId,
        type: d.type,
        status: d.status,
        title: d.title,
        description: d.description,
        cost: d.cost,
        mileage: d.mileage,
        performedAt: date(d.performedAt),
        nextDueDate: date(d.nextDueDate),
        nextDueMileage: d.nextDueMileage,
        garage: d.garage,
      },
      select: { id: true },
    });

    await syncVehicle(vehicle.id, d);
    return record;
  });

  if (!created) return { status: "error", message: "Véhicule introuvable." };

  await logActivity({
    tenantId: session.tenantId,
    userId: session.userId,
    action: "maintenance.created",
    subjectType: "maintenance",
    subjectId: created.id,
    properties: { title: d.title, vehicleId: d.vehicleId },
  });

  revalidatePath("/admin/maintenance");
  revalidatePath("/admin/cars");
  redirect("/admin/maintenance");
}

export async function updateMaintenanceAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await requireSession();
  if (!can(session, "maintenance.edit")) {
    return { status: "error", message: "Votre rôle ne permet pas de modifier une intervention." };
  }

  const id = Number(formData.get("maintenanceId"));
  if (!Number.isInteger(id) || id <= 0) return { status: "error", message: "Intervention introuvable." };

  const parsed = parseForm(formData);
  if (!parsed.success) return { status: "error", fieldErrors: fieldErrors(parsed.error) };
  const d = parsed.data;

  const updated = await withTenant(session.tenantId, async () => {
    const result = await db.maintenance.updateMany({
      where: { id },
      data: {
        vehicleId: d.vehicleId,
        type: d.type,
        status: d.status,
        title: d.title,
        description: d.description,
        cost: d.cost,
        mileage: d.mileage,
        performedAt: date(d.performedAt),
        nextDueDate: date(d.nextDueDate),
        nextDueMileage: d.nextDueMileage,
        garage: d.garage,
      },
    });
    if (result.count === 0) return 0;
    await syncVehicle(d.vehicleId, d);
    return result.count;
  });

  if (updated === 0) return { status: "error", message: "Intervention introuvable." };

  await logActivity({
    tenantId: session.tenantId,
    userId: session.userId,
    action: "maintenance.updated",
    subjectType: "maintenance",
    subjectId: id,
    properties: { title: d.title },
  });

  revalidatePath("/admin/maintenance");
  revalidatePath("/admin/cars");
  return { status: "success", message: "Intervention enregistrée." };
}

export async function deleteMaintenanceAction(formData: FormData): Promise<void> {
  const session = await requireSession();
  if (!can(session, "maintenance.edit")) return;

  const id = Number(formData.get("maintenanceId"));
  if (!Number.isInteger(id) || id <= 0) return;

  await withTenant(session.tenantId, () => db.maintenance.deleteMany({ where: { id } }));

  await logActivity({
    tenantId: session.tenantId,
    userId: session.userId,
    action: "maintenance.deleted",
    subjectType: "maintenance",
    subjectId: id,
  });

  revalidatePath("/admin/maintenance");
  redirect("/admin/maintenance");
}

/**
 * Répercute une intervention terminée sur le véhicule : kilométrage réel et,
 * pour un contrôle technique, date du prochain contrôle.
 */
async function syncVehicle(
  vehicleId: number,
  d: { status: string; mileage: number | null; type: string; nextDueDate: string | null },
): Promise<void> {
  if (d.status !== "done") return;

  const vehicle = await db.vehicle.findFirst({
    where: { id: vehicleId },
    select: { mileage: true, nextTechnicalControlDate: true },
  });
  if (!vehicle) return;

  const data: Record<string, unknown> = {};

  if (d.mileage !== null && d.mileage > vehicle.mileage) {
    data.mileage = d.mileage;
  }

  if (d.type === "technical_control" && d.nextDueDate) {
    data.nextTechnicalControlDate = date(d.nextDueDate);
    data.dttAlertState = "ok";
  }

  if (Object.keys(data).length > 0) {
    await db.vehicle.updateMany({ where: { id: vehicleId }, data });
  }
}

"use server";

import { revalidatePath } from "next/cache";
import { can } from "@/server/auth/permissions";
import { requireSession } from "@/server/auth/session-context";
import { logActivity } from "@/server/audit";
import { db } from "@/server/db";
import { withTenant } from "@/server/tenant-context";
import { findVehicleConflicts } from "@/server/queries/availability";
import type { ActionState } from "./types";

/**
 * Déplacement d'une réservation depuis le planning (glisser-déposer).
 *
 * Le déplacement ne change que la date de départ et — éventuellement — le
 * véhicule ; la durée est conservée. La disponibilité est **revérifiée** :
 * déplacer une barre ne doit pas créer un chevauchement.
 */

function shiftDate(iso: string, days: number): string {
  const [year, month, day] = iso.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function dayDiff(fromIso: string, toIso: string): number {
  const [fy, fm, fd] = fromIso.split("-").map(Number);
  const [ty, tm, td] = toIso.split("-").map(Number);
  return Math.round(
    (Date.UTC(ty, tm - 1, td) - Date.UTC(fy, fm - 1, fd)) / 86_400_000,
  );
}

export async function moveBookingAction(input: {
  bookingId: number;
  vehicleId: number;
  startDate: string;
}): Promise<ActionState> {
  const session = await requireSession();
  if (!can(session, "booking.edit")) {
    return { status: "error", message: "Votre rôle ne permet pas de déplacer une réservation." };
  }

  const { bookingId, vehicleId, startDate } = input;
  if (!Number.isInteger(bookingId) || !Number.isInteger(vehicleId)) {
    return { status: "error", message: "Déplacement invalide." };
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate)) {
    return { status: "error", message: "Date invalide." };
  }

  const booking = await withTenant(session.tenantId, () =>
    db.booking.findFirst({
      where: { id: bookingId },
      select: {
        id: true,
        bookingNumber: true,
        vehicleId: true,
        startDate: true,
        startTime: true,
        endDate: true,
        endTime: true,
        status: true,
      },
    }),
  );

  if (!booking) return { status: "error", message: "Réservation introuvable." };
  if (["completed", "cancelled", "declined"].includes(booking.status)) {
    return { status: "error", message: "Cette réservation ne peut plus être déplacée." };
  }

  const currentStart = booking.startDate.toISOString().slice(0, 10);
  const currentEnd = booking.endDate.toISOString().slice(0, 10);
  const durationDays = dayDiff(currentStart, currentEnd);
  const newEnd = shiftDate(startDate, durationDays);

  const conflicts = await findVehicleConflicts(
    session.tenantId,
    vehicleId,
    { startDate, startTime: booking.startTime, endDate: newEnd, endTime: booking.endTime },
    0,
    bookingId,
  );

  if (conflicts.length > 0) {
    return {
      status: "error",
      message: `Créneau indisponible : ${conflicts
        .map((c) => c.bookingNumber)
        .join(", ")} occupe déjà le véhicule.`,
    };
  }

  await withTenant(session.tenantId, () =>
    db.booking.updateMany({
      where: { id: bookingId },
      data: {
        vehicleId,
        startDate: new Date(`${startDate}T00:00:00Z`),
        endDate: new Date(`${newEnd}T00:00:00Z`),
      },
    }),
  );

  await logActivity({
    tenantId: session.tenantId,
    userId: session.userId,
    action: "booking.moved",
    subjectType: "booking",
    subjectId: bookingId,
    properties: { from: currentStart, to: startDate, vehicleId },
  });

  revalidatePath("/admin/planning");
  revalidatePath("/admin/calendar");
  revalidatePath("/admin/reservations");
  revalidatePath(`/admin/reservations/${bookingId}`);

  return { status: "success", message: "Réservation déplacée." };
}

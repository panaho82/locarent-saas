import { toTahitiInstant } from "@/lib/pricing";
import { db } from "@/server/db";
import { withTenant } from "@/server/tenant-context";

/**
 * Disponibilité d'un véhicule.
 *
 * Un véhicule est indisponible si une réservation active chevauche la période
 * demandée, **augmentée du tampon de nettoyage** (`turnaround`) de part et
 * d'autre : deux locations ne peuvent pas se toucher sans temps de préparation.
 *
 * Le calcul se fait en JavaScript avec la même conversion date+heure → instant
 * que le moteur de prix, plutôt qu'en SQL : la base stocke une `DATE` et une
 * `TIME` séparées, et les combiner dans le fuseau de la session est une source
 * d'erreurs silencieuses.
 */

export type Period = {
  startDate: string;
  startTime: string;
  endDate: string;
  endTime: string;
};

export type Conflict = {
  id: number;
  bookingNumber: string;
  startDate: Date;
  startTime: string;
  endDate: Date;
  endTime: string;
  status: string;
};

const ACTIVE_STATUSES = ["pending", "confirmed", "in_progress"] as const;

/** Réservations actives qui empêchent la période demandée. */
export async function findVehicleConflicts(
  tenantId: number,
  vehicleId: number,
  period: Period,
  turnaroundHours = 0,
  excludeBookingId?: number,
): Promise<Conflict[]> {
  const { startDate, startTime, endDate, endTime } = period;
  const start = toTahitiInstant(startDate, startTime);
  const end = toTahitiInstant(endDate, endTime);

  if (end <= start) {
    throw new RangeError("La date de retour doit être postérieure au départ.");
  }

  const buffer = Math.max(0, turnaroundHours) * 3_600_000;

  // Fenêtre large d'un jour : le filtrage fin se fait en JS, avec les tampons.
  const from = new Date(start - 86_400_000);
  const to = new Date(end + 86_400_000);

  const candidates = await withTenant(tenantId, () =>
    db.booking.findMany({
      where: {
        vehicleId,
        status: { in: [...ACTIVE_STATUSES] },
        ...(excludeBookingId ? { id: { not: excludeBookingId } } : {}),
        startDate: { lte: to },
        endDate: { gte: from },
      },
      select: {
        id: true,
        bookingNumber: true,
        startDate: true,
        startTime: true,
        endDate: true,
        endTime: true,
        status: true,
      },
      orderBy: { startDate: "asc" },
    }),
  );

  return candidates.filter((booking) => {
    const existingStart =
      toTahitiInstant(booking.startDate.toISOString().slice(0, 10), booking.startTime) - buffer;
    const existingEnd =
      toTahitiInstant(booking.endDate.toISOString().slice(0, 10), booking.endTime) + buffer;

    return start < existingEnd && end > existingStart;
  });
}

/** Véhicules libres sur une période (pour le sélecteur du formulaire). */
export async function findAvailableVehicles(
  tenantId: number,
  period: Period,
  turnaroundHours = 0,
): Promise<number[]> {
  const vehicles = await withTenant(tenantId, () =>
    db.vehicle.findMany({
      where: { isActive: true, status: { not: "maintenance" } },
      select: { id: true, _count: { select: { bookings: true } } },
    }),
  );

  const available: number[] = [];
  for (const vehicle of vehicles) {
    const conflicts = await findVehicleConflicts(tenantId, vehicle.id, period, turnaroundHours);
    if (conflicts.length === 0) available.push(vehicle.id);
  }
  return available;
}

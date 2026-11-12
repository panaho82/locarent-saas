import type { BookingFormOptions } from "@/components/admin/booking-form";

/** Le droit de négocier dépend de la session : il est ajouté par la page. */
export type BookingFormData = Omit<BookingFormOptions, "canNegotiate">;
import { db } from "@/server/db";
import { withTenant } from "@/server/tenant-context";

/** Données de référence du formulaire de réservation. */
export async function loadBookingFormOptions(
  tenantId: number,
): Promise<BookingFormData> {
  return withTenant(tenantId, async () => {
    const [customers, vehicles, locations, extras, settings] = await Promise.all([
      db.customer.findMany({
        orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
        take: 500,
        select: { id: true, firstName: true, lastName: true },
      }),
      db.vehicle.findMany({
        where: { isActive: true },
        orderBy: { name: "asc" },
        select: {
          id: true,
          name: true,
          licensePlate: true,
          dailyRate: true,
          weeklyRate: true,
          monthlyRate: true,
        },
      }),
      db.location.findMany({ orderBy: { name: "asc" } }),
      db.extraService.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }),
      db.settings.findFirst({
        select: { tvaEnabled: true, defaultTaxRate: true, rentalToleranceHours: true },
      }),
    ]);

    return {
      customers: customers.map((c) => ({
        id: c.id,
        name: [c.firstName, c.lastName].filter(Boolean).join(" "),
      })),
      vehicles,
      locations,
      extras: extras.map((e) => ({
        id: e.id,
        name: e.name,
        price: e.price,
        priceType: e.priceType,
      })),
      tvaEnabled: settings?.tvaEnabled ?? false,
      taxRate: Number(settings?.defaultTaxRate ?? 0),
      toleranceHours: settings?.rentalToleranceHours ?? 0,
    };
  });
}

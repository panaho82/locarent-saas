"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { can } from "@/server/auth/permissions";
import { requireSession } from "@/server/auth/session-context";
import { logActivity } from "@/server/audit";
import { db, prisma } from "@/server/db";
import { withTenant } from "@/server/tenant-context";
import { computePrice, suggestBilling, type PriceExtra } from "@/lib/pricing";
import { bookingSchema, fieldErrors } from "@/lib/validation/booking";
import { findVehicleConflicts } from "@/server/queries/availability";
import type { ActionState } from "./types";

/**
 * Réservations.
 *
 * Le prix est **toujours recalculé côté serveur** à partir des tarifs du
 * véhicule : le formulaire n'envoie jamais de montant. Les tarifs et les
 * options sont figés sur la réservation pour que l'historique ne bouge plus.
 */

/** Numéro `B-2026-00991`, séquence par agence et par année. */
async function nextBookingNumber(tenantId: number, year: number): Promise<string> {
  const prefix = `B-${year}-`;
  const count = await prisma.booking.count({
    where: { tenantId, bookingNumber: { startsWith: prefix } },
  });
  return `${prefix}${String(count + 1).padStart(5, "0")}`;
}

export async function createBookingAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await requireSession();
  if (!can(session, "booking.create")) {
    return { status: "error", message: "Votre rôle ne permet pas de créer une réservation." };
  }

  const parsed = bookingSchema.safeParse({
    customerId: formData.get("customerId"),
    vehicleId: formData.get("vehicleId"),
    pickupLocationId: formData.get("pickupLocationId"),
    dropoffLocationId: formData.get("dropoffLocationId"),
    startDate: formData.get("startDate"),
    startTime: formData.get("startTime"),
    endDate: formData.get("endDate"),
    endTime: formData.get("endTime"),
    unit: formData.get("unit"),
    value: formData.get("value"),
    isUnlimitedKilometers: formData.get("isUnlimitedKilometers"),
    negotiatedTotal: formData.get("negotiatedTotal"),
    discountLabel: formData.get("discountLabel"),
    discountType: formData.get("discountType"),
    discountValue: formData.get("discountValue"),
    notes: formData.get("notes"),
    internalNotes: formData.get("internalNotes"),
  });

  if (!parsed.success) return { status: "error", fieldErrors: fieldErrors(parsed.error) };
  const d = parsed.data;
  const confirmImmediately = formData.get("confirmImmediately") === "on";

  // --- Données de référence, toutes filtrées par agence ---------------------
  const context = await withTenant(session.tenantId, async () => {
    const [vehicle, customer, pickup, dropoff, settings] = await Promise.all([
      db.vehicle.findFirst({
        where: { id: d.vehicleId },
        select: {
          id: true,
          name: true,
          dailyRate: true,
          weeklyRate: true,
          monthlyRate: true,
          baseKilometers: true,
          extraKmPrice: true,
          isActive: true,
        },
      }),
      db.customer.findFirst({
        where: { id: d.customerId },
        select: { id: true, firstName: true, lastName: true },
      }),
      d.pickupLocationId
        ? db.location.findFirst({
            where: { id: d.pickupLocationId },
            select: { id: true, name: true, price: true, isFree: true },
          })
        : Promise.resolve(null),
      d.dropoffLocationId
        ? db.location.findFirst({
            where: { id: d.dropoffLocationId },
            select: { id: true, price: true, isFree: true },
          })
        : Promise.resolve(null),
      db.settings.findFirst({
        select: {
          tvaEnabled: true,
          defaultTaxRate: true,
          rentalToleranceHours: true,
          onlineBookingTurnaroundHours: true,
        },
      }),
    ]);

    const extraIds = formData
      .getAll("extras")
      .map((value) => Number(value))
      .filter((value) => Number.isInteger(value) && value > 0);

    const extras = extraIds.length
      ? await db.extraService.findMany({
          where: { id: { in: extraIds }, isActive: true },
          select: { id: true, name: true, price: true, priceType: true },
        })
      : [];

    return { vehicle, customer, pickup, dropoff, settings, extras };
  });

  const vehicle = context.vehicle;
  if (!vehicle) return { status: "error", message: "Véhicule introuvable." };
  if (!vehicle.isActive) {
    return { status: "error", message: "Ce véhicule est inactif." };
  }
  if (!context.customer) return { status: "error", message: "Client introuvable." };

  const tolerance = context.settings?.rentalToleranceHours ?? 0;
  const turnaround = context.settings?.onlineBookingTurnaroundHours ?? 0;

  // --- Disponibilité --------------------------------------------------------
  let conflicts: Awaited<ReturnType<typeof findVehicleConflicts>>;
  try {
    conflicts = await findVehicleConflicts(
      session.tenantId,
      d.vehicleId,
      d,
      turnaround,
    );
  } catch {
    return { status: "error", fieldErrors: { endDate: ["La date de retour doit suivre le départ."] } };
  }

  if (conflicts.length > 0) {
    const numbers = conflicts.map((c) => c.bookingNumber).join(", ");
    return {
      status: "error",
      message: `Véhicule indisponible sur cette période (réservation ${numbers}). Choisissez un autre véhicule ou ajustez les dates.`,
    };
  }

  // --- Prix -----------------------------------------------------------------
  const priceExtras: PriceExtra[] = context.extras.map((extra) => ({
    name: extra.name,
    unitPrice: extra.price,
    priceType: extra.priceType,
    qty: 1,
  }));

  const pickupFee =
    context.pickup && !context.pickup.isFree ? (context.pickup.price ?? 0) : 0;
  const dropoffFee =
    context.dropoff && !context.dropoff.isFree && d.dropoffLocationId !== d.pickupLocationId
      ? (context.dropoff.price ?? 0)
      : 0;

  const discounts =
    d.discountValue > 0 && d.discountType
      ? [{ label: d.discountLabel || null, type: d.discountType, value: d.discountValue }]
      : [];

  let price;
  try {
    price = computePrice({
      startDate: d.startDate,
      startTime: d.startTime,
      endDate: d.endDate,
      endTime: d.endTime,
      toleranceHours: tolerance,
      unit: d.unit,
      value: d.value,
      rates: {
        daily: vehicle.dailyRate,
        weekly: vehicle.weeklyRate,
        monthly: vehicle.monthlyRate,
      },
      extras: priceExtras,
      pickupFee,
      dropoffFee,
      discounts,
      tvaEnabled: context.settings?.tvaEnabled ?? false,
      taxRate: Number(context.settings?.defaultTaxRate ?? 0),
      vehicleTotalOverride: d.negotiatedTotal,
    });
  } catch {
    return { status: "error", message: "Période de location invalide." };
  }

  const negotiated = price.vehicleTotal !== price.computedVehicleTotal;
  if (negotiated && !can(session, "booking.negotiate_rate")) {
    return {
      status: "error",
      message: "Votre rôle ne permet pas de modifier le prix de la location.",
    };
  }

  const negotiatedPayload = negotiated
    ? {
        vehicleTotal: price.vehicleTotal,
        computedVehicleTotal: price.computedVehicleTotal,
        negotiatedBy: session.userId,
        negotiatedAt: new Date().toISOString(),
      }
    : null;

  // --- Écriture -------------------------------------------------------------
  const year = Number(d.startDate.slice(0, 4));
  let bookingId: number | null = null;

  for (let attempt = 0; attempt < 5 && bookingId === null; attempt += 1) {
    const bookingNumber = await nextBookingNumber(session.tenantId, year);
    try {
      const created = await prisma.$transaction(async (tx) => {
        const booking = await tx.booking.create({
          data: {
            tenantId: session.tenantId,
            bookingNumber,
            status: confirmImmediately ? "confirmed" : "pending",
            source: "admin",
            createdBy: session.userId,
            customerId: d.customerId,
            vehicleId: d.vehicleId,
            pickupLocationId: d.pickupLocationId,
            dropoffLocationId: d.dropoffLocationId,
            startDate: new Date(`${d.startDate}T00:00:00Z`),
            startTime: d.startTime,
            endDate: new Date(`${d.endDate}T00:00:00Z`),
            endTime: d.endTime,
            rentalDays: price.rentalDays,
            isUnlimitedKilometers: d.isUnlimitedKilometers,
            baseKilometers: d.isUnlimitedKilometers ? null : vehicle.baseKilometers,
            extraKmPrice: d.isUnlimitedKilometers ? null : vehicle.extraKmPrice,
            vehicleDailyRate: vehicle.dailyRate,
            vehicleWeeklyRate: vehicle.weeklyRate,
            vehicleMonthlyRate: vehicle.monthlyRate,
            durationUnit: d.unit,
            durationValue: d.value,
            negotiatedRates: negotiatedPayload ?? undefined,
            vehicleTotal: price.vehicleTotal,
            extrasTotal: price.extrasTotal,
            pickupLocationFee: pickupFee,
            dropoffLocationFee: dropoffFee,
            discounts: [],
            grandTotal: price.totalPrice,
            totalPrice: price.totalPrice,
            taxRate: price.taxRate,
            taxAmount: price.taxAmount,
            totalWithTax: price.totalWithTax,
            notes: d.notes ?? null,
            internalNotes: d.internalNotes ?? null,
          },
          select: { id: true },
        });

        for (const extra of context.extras) {
          await tx.bookingExtra.create({
            data: {
              bookingId: booking.id,
              extraServiceId: extra.id,
              name: extra.name,
              unitPrice: extra.price,
              priceType: extra.priceType,
              qty: 1,
              total:
                extra.price * (extra.priceType === "per_day" ? price.rentalDays : 1),
            },
          });
        }

        for (const discount of discounts) {
          await tx.bookingDiscount.create({
            data: {
              bookingId: booking.id,
              label: discount.label,
              type: discount.type,
              value: discount.value,
              amount: price.discountsTotal,
            },
          });
        }

        return booking;
      });
      bookingId = created.id;
    } catch (error) {
      // Collision de numéro : on retente avec la séquence suivante.
      if ((error as { code?: string }).code !== "P2002") {
        console.error("createBookingAction", error);
        return { status: "error", message: "Impossible d'enregistrer la réservation." };
      }
    }
  }

  if (bookingId === null) {
    return { status: "error", message: "Numéro de réservation introuvable, réessayez." };
  }

  await logActivity({
    tenantId: session.tenantId,
    userId: session.userId,
    action: "booking.created",
    subjectType: "booking",
    subjectId: bookingId,
    properties: {
      total: price.totalPrice,
      vehicle: vehicle.name,
      days: price.rentalDays,
    },
  });

  revalidatePath("/admin/reservations");
  redirect(`/admin/reservations/${bookingId}`);
}


/**
 * Modification d'une réservation au comptoir.
 *
 * Le prix est recalculé avec les tarifs **actuels** du véhicule (une
 * modification de dates ou d'options doit refléter le tarif du jour), puis les
 * options et remises sont remplacées. La disponibilité est revérifiée en
 * excluant la réservation elle-même.
 */
export async function updateBookingAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await requireSession();
  if (!can(session, "booking.edit")) {
    return { status: "error", message: "Votre rôle ne permet pas de modifier une réservation." };
  }

  const bookingId = Number(formData.get("bookingId"));
  if (!Number.isInteger(bookingId) || bookingId <= 0) {
    return { status: "error", message: "Réservation introuvable." };
  }

  const parsed = bookingSchema.safeParse({
    customerId: formData.get("customerId"),
    vehicleId: formData.get("vehicleId"),
    pickupLocationId: formData.get("pickupLocationId"),
    dropoffLocationId: formData.get("dropoffLocationId"),
    startDate: formData.get("startDate"),
    startTime: formData.get("startTime"),
    endDate: formData.get("endDate"),
    endTime: formData.get("endTime"),
    unit: formData.get("unit"),
    value: formData.get("value"),
    isUnlimitedKilometers: formData.get("isUnlimitedKilometers"),
    negotiatedTotal: formData.get("negotiatedTotal"),
    discountLabel: formData.get("discountLabel"),
    discountType: formData.get("discountType"),
    discountValue: formData.get("discountValue"),
    notes: formData.get("notes"),
    internalNotes: formData.get("internalNotes"),
  });
  if (!parsed.success) return { status: "error", fieldErrors: fieldErrors(parsed.error) };
  const d = parsed.data;

  const context = await withTenant(session.tenantId, async () => {
    const [booking, vehicle, pickup, dropoff, settings] = await Promise.all([
      db.booking.findFirst({ where: { id: bookingId }, select: { id: true, status: true } }),
      db.vehicle.findFirst({
        where: { id: d.vehicleId },
        select: {
          id: true,
          name: true,
          dailyRate: true,
          weeklyRate: true,
          monthlyRate: true,
          baseKilometers: true,
          extraKmPrice: true,
        },
      }),
      d.pickupLocationId
        ? db.location.findFirst({
            where: { id: d.pickupLocationId },
            select: { price: true, isFree: true },
          })
        : Promise.resolve(null),
      d.dropoffLocationId
        ? db.location.findFirst({
            where: { id: d.dropoffLocationId },
            select: { price: true, isFree: true },
          })
        : Promise.resolve(null),
      db.settings.findFirst({
        select: { tvaEnabled: true, defaultTaxRate: true, rentalToleranceHours: true },
      }),
    ]);

    const extraIds = formData
      .getAll("extras")
      .map((value) => Number(value))
      .filter((value) => Number.isInteger(value) && value > 0);

    const extras = extraIds.length
      ? await db.extraService.findMany({
          where: { id: { in: extraIds }, isActive: true },
          select: { id: true, name: true, price: true, priceType: true },
        })
      : [];

    return { booking, vehicle, pickup, dropoff, settings, extras };
  });

  if (!context.booking) return { status: "error", message: "Réservation introuvable." };
  if (["completed", "cancelled", "declined"].includes(context.booking.status)) {
    return { status: "error", message: "Cette réservation ne peut plus être modifiée." };
  }

  const vehicle = context.vehicle;
  if (!vehicle) return { status: "error", message: "Véhicule introuvable." };

  let conflicts;
  try {
    conflicts = await findVehicleConflicts(session.tenantId, d.vehicleId, d, 0, bookingId);
  } catch {
    return { status: "error", fieldErrors: { endDate: ["La date de retour doit suivre le départ."] } };
  }

  if (conflicts.length > 0) {
    return {
      status: "error",
      message: `Véhicule indisponible sur cette période (réservation ${conflicts
        .map((c) => c.bookingNumber)
        .join(", ")}).`,
    };
  }

  const pickupFee = context.pickup && !context.pickup.isFree ? (context.pickup.price ?? 0) : 0;
  const dropoffFee =
    context.dropoff && !context.dropoff.isFree && d.dropoffLocationId !== d.pickupLocationId
      ? (context.dropoff.price ?? 0)
      : 0;

  const discounts =
    d.discountValue > 0 && d.discountType
      ? [{ label: d.discountLabel || null, type: d.discountType, value: d.discountValue }]
      : [];

  let price;
  try {
    price = computePrice({
      startDate: d.startDate,
      startTime: d.startTime,
      endDate: d.endDate,
      endTime: d.endTime,
      toleranceHours: context.settings?.rentalToleranceHours ?? 0,
      unit: d.unit,
      value: d.value,
      rates: {
        daily: vehicle.dailyRate,
        weekly: vehicle.weeklyRate,
        monthly: vehicle.monthlyRate,
      },
      extras: context.extras.map((extra) => ({
        name: extra.name,
        unitPrice: extra.price,
        priceType: extra.priceType,
        qty: 1,
      })),
      pickupFee,
      dropoffFee,
      discounts,
      tvaEnabled: context.settings?.tvaEnabled ?? false,
      taxRate: Number(context.settings?.defaultTaxRate ?? 0),
      vehicleTotalOverride: d.negotiatedTotal,
    });
  } catch {
    return { status: "error", message: "Période de location invalide." };
  }

  const negotiatedUpdate = price.vehicleTotal !== price.computedVehicleTotal;
  if (negotiatedUpdate && !can(session, "booking.negotiate_rate")) {
    return {
      status: "error",
      message: "Votre rôle ne peut pas modifier le prix de la location.",
    };
  }

  await prisma.$transaction(async (tx) => {
    await tx.booking.update({
      where: { id: bookingId },
      data: {
        customerId: d.customerId,
        vehicleId: d.vehicleId,
        pickupLocationId: d.pickupLocationId,
        dropoffLocationId: d.dropoffLocationId,
        startDate: new Date(`${d.startDate}T00:00:00Z`),
        startTime: d.startTime,
        endDate: new Date(`${d.endDate}T00:00:00Z`),
        endTime: d.endTime,
        rentalDays: price.rentalDays,
        isUnlimitedKilometers: d.isUnlimitedKilometers,
        baseKilometers: d.isUnlimitedKilometers ? null : vehicle.baseKilometers,
        extraKmPrice: d.isUnlimitedKilometers ? null : vehicle.extraKmPrice,
        vehicleDailyRate: vehicle.dailyRate,
        vehicleWeeklyRate: vehicle.weeklyRate,
        vehicleMonthlyRate: vehicle.monthlyRate,
        durationUnit: d.unit,
        durationValue: d.value,
        negotiatedRates: negotiatedUpdate
          ? {
              vehicleTotal: price.vehicleTotal,
              computedVehicleTotal: price.computedVehicleTotal,
              negotiatedBy: session.userId,
              negotiatedAt: new Date().toISOString(),
            }
          : undefined,
        vehicleTotal: price.vehicleTotal,
        extrasTotal: price.extrasTotal,
        pickupLocationFee: pickupFee,
        dropoffLocationFee: dropoffFee,
        grandTotal: price.totalPrice,
        totalPrice: price.totalPrice,
        taxRate: price.taxRate,
        taxAmount: price.taxAmount,
        totalWithTax: price.totalWithTax,
        notes: d.notes ?? null,
        internalNotes: d.internalNotes ?? null,
      },
    });

    // Options et remises remplacées : ce sont des lignes figées, pas un stock.
    await tx.bookingExtra.deleteMany({ where: { bookingId } });
    for (const extra of context.extras) {
      await tx.bookingExtra.create({
        data: {
          bookingId,
          extraServiceId: extra.id,
          name: extra.name,
          unitPrice: extra.price,
          priceType: extra.priceType,
          qty: 1,
          total: extra.price * (extra.priceType === "per_day" ? price.rentalDays : 1),
        },
      });
    }

    await tx.bookingDiscount.deleteMany({ where: { bookingId } });
    for (const discount of discounts) {
      await tx.bookingDiscount.create({
        data: {
          bookingId,
          label: discount.label,
          type: discount.type,
          value: discount.value,
          amount: price.discountsTotal,
        },
      });
    }
  });

  await logActivity({
    tenantId: session.tenantId,
    userId: session.userId,
    action: "booking.updated",
    subjectType: "booking",
    subjectId: bookingId,
    properties: { total: price.totalPrice, days: price.rentalDays },
  });

  revalidatePath("/admin/reservations");
  revalidatePath(`/admin/reservations/${bookingId}`);
  revalidatePath("/admin/planning");
  redirect(`/admin/reservations/${bookingId}`);
}

/** Change le statut d'une réservation. */
async function setStatus(
  bookingId: number,
  status: "confirmed" | "cancelled" | "declined",
  permission: "booking.confirm" | "booking.cancel",
  action: string,
): Promise<void> {
  const session = await requireSession();
  if (!can(session, permission)) return;

  await withTenant(session.tenantId, () =>
    db.booking.updateMany({
      where: { id: bookingId },
      data: {
        status,
        ...(status === "cancelled"
          ? { cancelledAt: new Date(), cancellationReason: "Annulée depuis le back-office" }
          : {}),
      },
    }),
  );

  await logActivity({
    tenantId: session.tenantId,
    userId: session.userId,
    action,
    subjectType: "booking",
    subjectId: bookingId,
  });

  revalidatePath("/admin/reservations");
  revalidatePath(`/admin/reservations/${bookingId}`);
}

export async function confirmBookingAction(formData: FormData): Promise<void> {
  const id = Number(formData.get("bookingId"));
  if (Number.isInteger(id) && id > 0) {
    await setStatus(id, "confirmed", "booking.confirm", "booking.confirmed");
  }
}

export async function cancelBookingAction(formData: FormData): Promise<void> {
  const id = Number(formData.get("bookingId"));
  if (Number.isInteger(id) && id > 0) {
    await setStatus(id, "cancelled", "booking.cancel", "booking.cancelled");
  }
}

export async function declineBookingAction(formData: FormData): Promise<void> {
  const id = Number(formData.get("bookingId"));
  if (Number.isInteger(id) && id > 0) {
    await setStatus(id, "declined", "booking.cancel", "booking.declined");
  }
}

/** Suggestion d'unité de facturation pour une durée, côté formulaire. */
export async function suggestBillingForVehicle(
  vehicleId: number,
  days: number,
): Promise<{ unit: string; value: number } | null> {
  const session = await requireSession();
  if (!Number.isInteger(vehicleId) || vehicleId <= 0 || days <= 0) return null;

  const vehicle = await withTenant(session.tenantId, () =>
    db.vehicle.findFirst({
      where: { id: vehicleId },
      select: { dailyRate: true, weeklyRate: true, monthlyRate: true },
    }),
  );
  if (!vehicle) return null;

  const suggestion = suggestBilling(days, {
    daily: vehicle.dailyRate,
    weekly: vehicle.weeklyRate,
    monthly: vehicle.monthlyRate,
  });
  return { unit: suggestion.unit, value: suggestion.value };
}

import { notFound } from "next/navigation";
import { PageHeader } from "@/components/admin/ui";
import {
  BookingForm,
  type BookingInitial,
} from "@/components/admin/booking-form";
import { can } from "@/server/auth/permissions";
import { AccessDenied } from "@/components/admin/ui";
import { requireSession } from "@/server/auth/session-context";
import { db } from "@/server/db";
import { loadBookingFormOptions } from "@/server/queries/booking-form";
import { withTenant } from "@/server/tenant-context";

export default async function EditBookingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireSession();
  const { id } = await params;
  const bookingId = Number(id);
  if (!Number.isInteger(bookingId)) notFound();

  if (!can(session, "booking.edit")) {
    return (
      <>
        <PageHeader title="Modifier la réservation" breadcrumb={["Accueil", "Réservations"]} />
        <AccessDenied />
      </>
    );
  }

  const booking = await withTenant(session.tenantId, () =>
    db.booking.findFirst({
      where: { id: bookingId },
      include: { extras: { select: { extraServiceId: true } }, discountsList: true },
    }),
  );
  if (!booking) notFound();

  const options = await loadBookingFormOptions(session.tenantId);

  const iso = (value: Date) => value.toISOString().slice(0, 10);
  const discount = booking.discountsList[0];

  const initial: BookingInitial = {
    id: booking.id,
    customerId: String(booking.customerId),
    vehicleId: String(booking.vehicleId),
    pickupLocationId: booking.pickupLocationId ? String(booking.pickupLocationId) : "",
    dropoffLocationId: booking.dropoffLocationId ? String(booking.dropoffLocationId) : "",
    startDate: iso(booking.startDate),
    startTime: booking.startTime,
    endDate: iso(booking.endDate),
    endTime: booking.endTime,
    unit: booking.durationUnit,
    value: String(booking.durationValue),
    extras: booking.extras
      .map((e) => e.extraServiceId)
      .filter((value): value is number => value !== null),
    discountType: discount?.type ?? "amount",
    discountValue: discount ? String(discount.value) : "",
    discountLabel: discount?.label ?? "",
    notes: booking.notes ?? "",
    internalNotes: booking.internalNotes ?? "",
    isUnlimitedKilometers: booking.isUnlimitedKilometers,
  };

  return (
    <>
      <PageHeader
        title={`Modifier ${booking.bookingNumber}`}
        breadcrumb={["Accueil", "Réservations", booking.bookingNumber, "Modifier"]}
      />
      <BookingForm mode="edit" options={options} initial={initial} />
    </>
  );
}

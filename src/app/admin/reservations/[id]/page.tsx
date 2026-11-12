import Link from "next/link";
import { notFound } from "next/navigation";
import { AccessDenied, PageHeader } from "@/components/admin/ui";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { formatDateOnly, formatDateTime, formatXPF } from "@/lib/format";
import { unitLabel } from "@/lib/pricing";
import { BOOKING_STATUS_DOT, BOOKING_STATUS_LABELS } from "@/lib/validation/booking";
import { can } from "@/server/auth/permissions";
import { requireSession } from "@/server/auth/session-context";
import { db } from "@/server/db";
import { withTenant } from "@/server/tenant-context";
import {
  cancelBookingAction,
  confirmBookingAction,
} from "@/server/actions/bookings";

export default async function BookingDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireSession();
  const { id } = await params;
  const bookingId = Number(id);
  if (!Number.isInteger(bookingId)) notFound();

  if (!can(session, "booking.view")) {
    return (
      <>
        <PageHeader title="Réservation" breadcrumb={["Accueil", "Réservations"]} />
        <AccessDenied />
      </>
    );
  }

  const booking = await withTenant(session.tenantId, () =>
    db.booking.findFirst({
      where: { id: bookingId },
      include: {
        customer: true,
        vehicle: true,
        pickupLocation: true,
        dropoffLocation: true,
        extras: true,
        discountsList: true,
      },
    }),
  );
  if (!booking) notFound();

  // Dernière tentative de notification de l'agence (contrat signé).
  const notification = await withTenant(session.tenantId, () =>
    db.activityLog.findFirst({
      where: {
        subjectType: "booking",
        subjectId: bookingId,
        action: { in: ["booking.notified", "booking.notification_failed"] },
      },
      orderBy: { createdAt: "desc" },
      select: { action: true, properties: true, createdAt: true },
    }),
  );

  const notificationInfo = (() => {
    if (!notification) return null;
    const properties = notification.properties as {
      recipient?: string;
      delivered?: boolean;
      error?: string;
    } | null;
    return {
      failed: notification.action === "booking.notification_failed",
      recipient: properties?.recipient ?? null,
      delivered: properties?.delivered ?? false,
      error: properties?.error ?? null,
      at: notification.createdAt,
    };
  })();

  const customerName = [booking.customer.firstName, booking.customer.lastName]
    .filter(Boolean)
    .join(" ");

  const discountsTotal = booking.discountsList.reduce((sum, d) => sum + d.amount, 0);

  const negotiated = (() => {
    const value = booking.negotiatedRates;
    if (!value || typeof value !== "object" || Array.isArray(value)) return null;
    const data = value as { vehicleTotal?: number; computedVehicleTotal?: number };
    if (typeof data.vehicleTotal !== "number" || typeof data.computedVehicleTotal !== "number") {
      return null;
    }
    return data.vehicleTotal !== data.computedVehicleTotal ? data : null;
  })();

  return (
    <>
      <PageHeader
        title={booking.bookingNumber}
        breadcrumb={["Accueil", "Réservations", booking.bookingNumber]}
        actions={
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-line px-3 py-1 text-[11px] font-medium text-ink">
              <span
                aria-hidden
                className={cn("size-1.5 rounded-full", BOOKING_STATUS_DOT[booking.status])}
              />
              {BOOKING_STATUS_LABELS[booking.status]}
            </span>
            <a
              href={`/admin/reservations/${booking.id}/contract`}
              target="_blank"
              rel="noreferrer"
              className="rounded-btn border border-line px-3 py-1.5 text-[13px] font-medium text-ink hover:bg-app"
            >
              Contrat
            </a>
            {can(session, "booking.edit") &&
            !["completed", "cancelled", "declined"].includes(booking.status) ? (
              <Link
                href={`/admin/reservations/${booking.id}/edit`}
                className="rounded-btn border border-line px-3 py-1.5 text-[13px] font-medium text-ink hover:bg-app"
              >
                Modifier
              </Link>
            ) : null}
            {booking.status === "pending" && can(session, "booking.confirm") ? (
              <form action={confirmBookingAction}>
                <input type="hidden" name="bookingId" value={booking.id} />
                <Button type="submit" size="sm">Confirmer</Button>
              </form>
            ) : null}
            {["pending", "confirmed"].includes(booking.status) && can(session, "booking.cancel") ? (
              <form action={cancelBookingAction}>
                <input type="hidden" name="bookingId" value={booking.id} />
                <Button type="submit" size="sm" variant="secondary">Annuler</Button>
              </form>
            ) : null}
          </div>
        }
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <section className="rounded-card border border-line bg-surface p-5">
            <h2 className="mb-4 text-sm font-semibold text-ink">Location</h2>
            <dl className="grid gap-4 sm:grid-cols-2">
              {[
                ["Client", customerName || "—"],
                ["Véhicule", `${booking.vehicle.name} · ${booking.vehicle.licensePlate}`],
                [
                  "Départ",
                  `${formatDateOnly(booking.startDate)} à ${booking.startTime}${
                    booking.pickupLocation ? ` · ${booking.pickupLocation.name}` : ""
                  }`,
                ],
                [
                  "Retour",
                  `${formatDateOnly(booking.endDate)} à ${booking.endTime}${
                    booking.dropoffLocation ? ` · ${booking.dropoffLocation.name}` : ""
                  }`,
                ],
                ["Durée facturée", `${booking.durationValue} ${unitLabel(booking.durationUnit, booking.durationValue)}`],
                ["Jours réels", String(booking.rentalDays)],
                ["Kilométrage", booking.isUnlimitedKilometers ? "Illimité" : `${booking.baseKilometers ?? 0} km inclus`],
                ["Source", booking.source === "online" ? "En ligne" : "Comptoir"],
              ].map(([label, value]) => (
                <div key={label}>
                  <dt className="text-[11px] font-medium uppercase tracking-wide text-muted">{label}</dt>
                  <dd className="mt-0.5 text-[13px] text-ink">{value}</dd>
                </div>
              ))}
            </dl>
            {booking.durationUnit === "days" && booking.rentalDays > booking.durationValue ? (
              <p className="mt-4 rounded-btn border border-warning/40 bg-warning/10 px-3 py-2 text-[12px] text-ink">
                Facturé {booking.durationValue} jour{booking.durationValue > 1 ? "s" : ""} pour{" "}
                {booking.rentalDays} jours réels : c&apos;est un choix commercial, vérifiez qu&apos;il
                est voulu.
              </p>
            ) : null}
            {booking.notes ? (
              <p className="mt-4 border-t border-line pt-3 text-[13px] text-body">{booking.notes}</p>
            ) : null}
            {booking.internalNotes ? (
              <p className="mt-2 text-[12px] text-muted">Interne : {booking.internalNotes}</p>
            ) : null}
          </section>

          <section className="rounded-card border border-line bg-surface p-5">
            <h2 className="mb-3 text-sm font-semibold text-ink">Détail de la facturation</h2>
            <ul className="space-y-1.5 text-[13px]">
              <li className="flex justify-between">
                <span className="text-body">
                  Location {booking.durationValue}{" "}
                  {unitLabel(booking.durationUnit, booking.durationValue)}
                  {negotiated ? (
                    <span className="ml-1 rounded-full bg-brand-soft px-2 py-0.5 text-[10px] font-semibold text-brand-text">
                      tarif négocié
                    </span>
                  ) : null}
                </span>
                <span className="text-ink">{formatXPF(booking.vehicleTotal)}</span>
              </li>
              {negotiated ? (
                <li className="flex justify-between text-[12px]">
                  <span className="text-muted">Prix calculé avant négociation</span>
                  <span className="text-muted line-through">
                    {formatXPF(negotiated.computedVehicleTotal ?? 0)}
                  </span>
                </li>
              ) : null}
              {booking.extras.map((extra) => (
                <li key={extra.id} className="flex justify-between">
                  <span className="text-body">{extra.name}</span>
                  <span className="text-ink">{formatXPF(extra.total)}</span>
                </li>
              ))}
              {booking.pickupLocationFee > 0 ? (
                <li className="flex justify-between">
                  <span className="text-body">Frais de prise en charge</span>
                  <span className="text-ink">{formatXPF(booking.pickupLocationFee)}</span>
                </li>
              ) : null}
              {booking.dropoffLocationFee > 0 ? (
                <li className="flex justify-between">
                  <span className="text-body">Frais de restitution</span>
                  <span className="text-ink">{formatXPF(booking.dropoffLocationFee)}</span>
                </li>
              ) : null}
              {booking.discountsList.map((discount) => (
                <li key={discount.id} className="flex justify-between">
                  <span className="text-body">{discount.label ?? "Remise"}</span>
                  <span className="text-success">−{formatXPF(discount.amount)}</span>
                </li>
              ))}
            </ul>

            <div className="mt-4 space-y-1 border-t border-line pt-3 text-[13px]">
              <div className="flex justify-between">
                <span className="text-body">Total HT</span>
                <span className="font-medium text-ink">{formatXPF(booking.totalPrice)}</span>
              </div>
              {Number(booking.taxRate) > 0 ? (
                <div className="flex justify-between">
                  <span className="text-body">TVA {Number(booking.taxRate)} %</span>
                  <span className="text-ink">{formatXPF(booking.taxAmount)}</span>
                </div>
              ) : null}
              <div className="flex justify-between border-t border-line pt-2">
                <span className="font-semibold text-ink">Total TTC</span>
                <span className="text-lg font-bold text-ink">{formatXPF(booking.totalWithTax)}</span>
              </div>
              {discountsTotal > 0 ? (
                <p className="text-[11px] text-muted">Dont {formatXPF(discountsTotal)} de remise.</p>
              ) : null}
            </div>
          </section>
        </div>

        <aside className="space-y-4">
          <section className="rounded-card border border-line bg-surface p-5">
            <h2 className="mb-3 text-sm font-semibold text-ink">Client</h2>
            <Link
              href={`/admin/customers/${booking.customerId}`}
              className="text-[13px] font-semibold text-ink hover:text-brand-text"
            >
              {customerName || "—"}
            </Link>
            <p className="mt-1 text-[12px] text-muted">{booking.customer.email ?? "—"}</p>
            <p className="text-[12px] text-muted">
              {[booking.customer.phoneCode, booking.customer.phone].filter(Boolean).join(" ") || "—"}
            </p>
          </section>

          <section className="rounded-card border border-line bg-surface p-5">
            <h2 className="mb-2 text-sm font-semibold text-ink">Check-in client</h2>
            {booking.checkInCompletedAt ? (
              <>
                <p className="text-[12px] text-success">
                  Signé le {formatDateTime(booking.checkInCompletedAt)}
                  {booking.contractSignatureName ? ` par ${booking.contractSignatureName}` : ""}.
                </p>
                <a
                  href={`/check-in/${booking.checkInToken}`}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-2 inline-block text-[12px] font-medium text-brand-text hover:underline"
                >
                  Ouvrir la page du client ↗
                </a>
                {notificationInfo ? (
                  <p className="mt-3 border-t border-line pt-2 text-[11px] text-muted">
                    {notificationInfo.failed
                      ? `Notification en échec le ${formatDateTime(notificationInfo.at)} — ${notificationInfo.error ?? "erreur inconnue"}.`
                      : notificationInfo.delivered
                        ? `Agence prévenue le ${formatDateTime(notificationInfo.at)} (${notificationInfo.recipient}).`
                        : `Notification journalisée le ${formatDateTime(notificationInfo.at)} — transport « console », aucun email réel n'est parti.`}
                  </p>
                ) : null}
              </>
            ) : (
              <>
                <p className="text-[12px] text-muted">
                  Envoyez ce lien au client : il photographiera son permis et sa pièce
                  d&apos;identité, lira le contrat et le signera.
                </p>
                <a
                  href={`/check-in/${booking.checkInToken}`}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-2 block break-all rounded-btn border border-line bg-app px-2 py-1.5 text-[11px] text-ink hover:underline"
                >
                  /check-in/{booking.checkInToken}
                </a>
              </>
            )}
          </section>
        </aside>
      </div>
    </>
  );
}

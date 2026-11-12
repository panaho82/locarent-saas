import Link from "next/link";
import { MoreVertical, Plus } from "lucide-react";
import { AccessDenied, PageHeader } from "@/components/admin/ui";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { formatDateOnly, formatXPF } from "@/lib/format";
import { BOOKING_STATUS_DOT, BOOKING_STATUS_LABELS } from "@/lib/validation/booking";
import { can } from "@/server/auth/permissions";
import { requireSession } from "@/server/auth/session-context";
import { db } from "@/server/db";
import { withTenant } from "@/server/tenant-context";
import type { Prisma } from "@/generated/prisma/client";

export const metadata = { title: "Réservations" };

const STATUSES = ["pending", "confirmed", "in_progress", "completed", "cancelled"] as const;

export default async function BookingsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await requireSession();

  if (!can(session, "booking.view")) {
    return (
      <>
        <PageHeader title="Réservations" breadcrumb={["Accueil", "Réservations"]} />
        <AccessDenied />
      </>
    );
  }

  const params = await searchParams;
  const status = typeof params.status === "string" ? params.status : "";
  const q = typeof params.q === "string" ? params.q.trim() : "";

  const where: Prisma.BookingWhereInput = {
    ...(status && STATUSES.includes(status as (typeof STATUSES)[number])
      ? { status: status as (typeof STATUSES)[number] }
      : {}),
    ...(q
      ? {
          OR: [
            { bookingNumber: { contains: q, mode: "insensitive" } },
            { customer: { lastName: { contains: q, mode: "insensitive" } } },
            { customer: { firstName: { contains: q, mode: "insensitive" } } },
            { vehicle: { licensePlate: { contains: q, mode: "insensitive" } } },
          ],
        }
      : {}),
  };

  const { bookings, total } = await withTenant(session.tenantId, async () => {
    const [bookings, total] = await Promise.all([
      db.booking.findMany({
        where,
        orderBy: { startDate: "desc" },
        take: 50,
        select: {
          id: true,
          bookingNumber: true,
          status: true,
          startDate: true,
          startTime: true,
          endDate: true,
          endTime: true,
          totalWithTax: true,
          customer: { select: { firstName: true, lastName: true } },
          vehicle: { select: { name: true, licensePlate: true } },
        },
      }),
      db.booking.count({ where }),
    ]);
    return { bookings, total };
  });

  return (
    <>
      <PageHeader
        title="Réservations"
        breadcrumb={["Accueil", "Réservations"]}
        actions={
          can(session, "booking.create") ? (
            <Link href="/admin/reservations/new" className={cn(buttonVariants({}), "gap-2")}>
              <Plus className="size-4" aria-hidden />
              Nouvelle réservation
            </Link>
          ) : null
        }
      />

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <nav className="flex flex-wrap gap-1 rounded-btn border border-line bg-surface p-1" aria-label="Filtre par statut">
          <Link
            href="/admin/reservations"
            aria-current={!status ? "page" : undefined}
            className={cn(
              "rounded-btn px-3 py-1.5 text-[13px] font-medium",
              !status ? "bg-brand-soft text-brand-text" : "text-body hover:text-ink",
            )}
          >
            Toutes
          </Link>
          {STATUSES.map((key) => (
            <Link
              key={key}
              href={`/admin/reservations?status=${key}`}
              aria-current={status === key ? "page" : undefined}
              className={cn(
                "rounded-btn px-3 py-1.5 text-[13px] font-medium",
                status === key ? "bg-brand-soft text-brand-text" : "text-body hover:text-ink",
              )}
            >
              {BOOKING_STATUS_LABELS[key]}
            </Link>
          ))}
        </nav>

        <form action="/admin/reservations" className="flex items-center gap-2">
          {status ? <input type="hidden" name="status" value={status} /> : null}
          <input
            type="search"
            name="q"
            defaultValue={q}
            placeholder="N°, client, immatriculation"
            aria-label="Rechercher une réservation"
            className="h-9 w-[250px] rounded-btn border border-line bg-surface px-3 text-[13px] text-ink placeholder:text-muted"
          />
          <button
            type="submit"
            className="rounded-btn border border-line bg-surface px-3 py-1.5 text-[13px] text-body hover:text-ink"
          >
            Rechercher
          </button>
        </form>
      </div>

      <p className="mb-3 text-[13px] text-body">
        {total} réservation{total > 1 ? "s" : ""}
      </p>

      <div className="rounded-card border border-line bg-surface">
        <table className="w-full border-collapse text-left">
          <thead>
            <tr className="border-b border-line">
              {["Réservation", "Véhicule", "Période", "Montant", "Statut"].map((label) => (
                <th
                  key={label}
                  scope="col"
                  className="px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.03em] text-ink"
                >
                  {label}
                </th>
              ))}
              <th scope="col" className="px-4 py-3">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {bookings.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-14 text-center">
                  <p className="text-sm font-semibold text-ink">Aucune réservation</p>
                  <p className="mt-1 text-xs text-muted">
                    Créez une réservation au comptoir pour démarrer.
                  </p>
                </td>
              </tr>
            ) : (
              bookings.map((booking) => (
                <tr key={booking.id} className="border-b border-line last:border-0">
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/reservations/${booking.id}`}
                      className="text-[13px] font-semibold text-ink hover:text-brand-text"
                    >
                      {booking.bookingNumber}
                    </Link>
                    <p className="text-[11px] text-muted">
                      {[booking.customer.firstName, booking.customer.lastName]
                        .filter(Boolean)
                        .join(" ")}
                    </p>
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-[13px] text-body">{booking.vehicle.name}</p>
                    <p className="text-[11px] text-muted">{booking.vehicle.licensePlate}</p>
                  </td>
                  <td className="px-4 py-3 text-[13px] text-body">
                    {formatDateOnly(booking.startDate)} {booking.startTime}
                    {" → "}
                    {formatDateOnly(booking.endDate)} {booking.endTime}
                  </td>
                  <td className="px-4 py-3 text-[13px] font-medium text-ink">
                    {formatXPF(booking.totalWithTax)}
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-line px-2.5 py-0.5 text-[11px] font-medium text-ink">
                      <span
                        aria-hidden
                        className={cn("size-1.5 rounded-full", BOOKING_STATUS_DOT[booking.status])}
                      />
                      {BOOKING_STATUS_LABELS[booking.status]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/admin/reservations/${booking.id}`}
                      aria-label={`Ouvrir ${booking.bookingNumber}`}
                      className="inline-flex rounded-btn p-1.5 text-muted hover:bg-app hover:text-ink"
                    >
                      <MoreVertical className="size-4" aria-hidden />
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}

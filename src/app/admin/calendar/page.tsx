import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { AccessDenied, PageHeader } from "@/components/admin/ui";
import { cn } from "@/lib/cn";
import {
  addDays,
  daysInMonth,
  isWeekend,
  monthLabel,
  startOfMonth,
  todayIso,
} from "@/lib/dates";
import { BOOKING_STATUS_LABELS } from "@/lib/validation/booking";
import { can } from "@/server/auth/permissions";
import { requireSession } from "@/server/auth/session-context";
import { db } from "@/server/db";
import { withTenant } from "@/server/tenant-context";

export const metadata = { title: "Calendrier" };

const BAR: Record<string, string> = {
  pending: "bg-warning/20 text-ink",
  confirmed: "bg-success/15 text-ink",
  in_progress: "bg-info/20 text-ink",
  completed: "bg-line text-body",
  cancelled: "bg-danger/10 text-body line-through",
  declined: "bg-danger/10 text-body line-through",
};

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await requireSession();

  if (!can(session, "booking.view")) {
    return (
      <>
        <PageHeader title="Calendrier" breadcrumb={["Accueil", "Calendrier"]} />
        <AccessDenied />
      </>
    );
  }

  const params = await searchParams;
  const today = todayIso();
  const monthStart =
    typeof params.month === "string" && /^\d{4}-\d{2}$/.test(params.month)
      ? `${params.month}-01`
      : startOfMonth(today);

  const total = daysInMonth(monthStart);
  const monthEnd = addDays(monthStart, total - 1);

  // La grille commence le lundi de la semaine du 1er.
  const firstWeekday = (new Date(`${monthStart}T00:00:00Z`).getUTCDay() + 6) % 7;
  const gridStart = addDays(monthStart, -firstWeekday);
  const cells = Array.from({ length: 42 }, (_, index) => addDays(gridStart, index));

  const bookings = await withTenant(session.tenantId, () =>
    db.booking.findMany({
      where: {
        status: { notIn: ["expired"] },
        startDate: { lte: new Date(`${monthEnd}T00:00:00Z`) },
        endDate: { gte: new Date(`${monthStart}T00:00:00Z`) },
      },
      orderBy: { startDate: "asc" },
      select: {
        id: true,
        bookingNumber: true,
        status: true,
        startDate: true,
        endDate: true,
        customer: { select: { firstName: true, lastName: true } },
        vehicle: { select: { name: true } },
      },
    }),
  );

  /** Réservations couvrant un jour donné. */
  const forDay = (iso: string) =>
    bookings.filter((b) => {
      const start = b.startDate.toISOString().slice(0, 10);
      const end = b.endDate.toISOString().slice(0, 10);
      return iso >= start && iso <= end;
    });

  const prevMonth = addDays(monthStart, -1).slice(0, 7);
  const nextMonth = addDays(monthEnd, 1).slice(0, 7);

  return (
    <>
      <PageHeader
        title="Calendrier"
        breadcrumb={["Accueil", "Calendrier"]}
        actions={
          <div className="flex items-center gap-1">
            <Link
              href={`/admin/calendar?month=${prevMonth}`}
              aria-label="Mois précédent"
              className="rounded-btn border border-line px-2 py-1.5 text-body hover:bg-app"
            >
              <ChevronLeft className="size-4" aria-hidden />
            </Link>
            <Link
              href="/admin/calendar"
              className="rounded-btn border border-line px-3 py-1.5 text-[13px] font-medium text-ink hover:bg-app"
            >
              Aujourd&apos;hui
            </Link>
            <Link
              href={`/admin/calendar?month=${nextMonth}`}
              aria-label="Mois suivant"
              className="rounded-btn border border-line px-2 py-1.5 text-body hover:bg-app"
            >
              <ChevronRight className="size-4" aria-hidden />
            </Link>
          </div>
        }
      />

      <h2 className="mb-4 text-[15px] font-semibold capitalize text-ink">{monthLabel(monthStart)}</h2>

      <div className="overflow-hidden rounded-card border border-line bg-surface">
        <div className="grid grid-cols-7 border-b border-line bg-app/60">
          {["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"].map((day) => (
            <div
              key={day}
              className="px-2 py-2 text-center text-[11px] font-semibold uppercase tracking-wide text-muted"
            >
              {day}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7">
          {cells.map((iso) => {
            const inMonth = iso.slice(0, 7) === monthStart.slice(0, 7);
            const dayBookings = forDay(iso);
            return (
              <div
                key={iso}
                className={cn(
                  "min-h-[104px] border-b border-r border-line p-1.5 last:border-r-0",
                  !inMonth && "bg-app/40 text-muted",
                  iso === today && "bg-brand-soft/50",
                  isWeekend(iso) && inMonth && iso !== today && "bg-app/30",
                )}
              >
                <p
                  className={cn(
                    "mb-1 text-[11px] font-semibold",
                    iso === today ? "text-brand-text" : inMonth ? "text-ink" : "text-muted",
                  )}
                >
                  {iso.slice(8, 10)}
                </p>
                <ul className="space-y-0.5">
                  {dayBookings.slice(0, 3).map((booking) => (
                    <li key={booking.id}>
                      <Link
                        href={`/admin/reservations/${booking.id}`}
                        className={cn(
                          "block truncate rounded px-1 py-0.5 text-[10px] hover:underline",
                          BAR[booking.status] ?? "bg-line",
                        )}
                        title={`${booking.bookingNumber} · ${BOOKING_STATUS_LABELS[booking.status] ?? booking.status}`}
                      >
                        {booking.customer.lastName ?? booking.bookingNumber}
                        <span className="text-[9px] opacity-70"> · {booking.vehicle.name}</span>
                      </Link>
                    </li>
                  ))}
                  {dayBookings.length > 3 ? (
                    <li className="px-1 text-[9px] text-muted">+{dayBookings.length - 3} autre(s)</li>
                  ) : null}
                </ul>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}

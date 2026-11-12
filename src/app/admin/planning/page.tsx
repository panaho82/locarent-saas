import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { AccessDenied, PageHeader } from "@/components/admin/ui";
import { PlanningGrid } from "@/components/admin/planning-grid";
import { cn } from "@/lib/cn";
import { addDays, monthLabel, todayIso } from "@/lib/dates";
import { can } from "@/server/auth/permissions";
import { requireSession } from "@/server/auth/session-context";
import { db } from "@/server/db";
import { withTenant } from "@/server/tenant-context";

export const metadata = { title: "Planning" };

const WINDOW_DAYS = 21;

export default async function PlanningPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await requireSession();

  if (!can(session, "booking.view")) {
    return (
      <>
        <PageHeader title="Planning" breadcrumb={["Accueil", "Planning"]} />
        <AccessDenied />
      </>
    );
  }

  const params = await searchParams;
  const from =
    typeof params.from === "string" && /^\d{4}-\d{2}-\d{2}$/.test(params.from)
      ? params.from
      : todayIso();

  const today = todayIso();
  const days = Array.from({ length: WINDOW_DAYS }, (_, index) => addDays(from, index));
  const windowEnd = days[days.length - 1]!;

  const { vehicles, bookings } = await withTenant(session.tenantId, async () => {
    const [vehicles, bookings] = await Promise.all([
      db.vehicle.findMany({
        where: { isActive: true },
        orderBy: [{ name: "asc" }],
        select: {
          id: true,
          name: true,
          licensePlate: true,
          category: { select: { name: true } },
        },
      }),
      db.booking.findMany({
        where: {
          status: { notIn: ["expired"] },
          startDate: { lte: new Date(`${windowEnd}T00:00:00Z`) },
          endDate: { gte: new Date(`${from}T00:00:00Z`) },
        },
        orderBy: { startDate: "asc" },
        select: {
          id: true,
          bookingNumber: true,
          status: true,
          startDate: true,
          endDate: true,
          startTime: true,
          endTime: true,
          vehicleId: true,
          customer: { select: { firstName: true, lastName: true } },
        },
      }),
    ]);

    return { vehicles, bookings };
  });

  return (
    <>
      <PageHeader
        title="Planning"
        breadcrumb={["Accueil", "Planning"]}
        actions={
          <div className="flex items-center gap-1">
            <Link
              href={`/admin/planning?from=${addDays(from, -14)}`}
              aria-label="Période précédente"
              className="rounded-btn border border-line px-2 py-1.5 text-body hover:bg-app"
            >
              <ChevronLeft className="size-4" aria-hidden />
            </Link>
            <Link
              href="/admin/planning"
              className="rounded-btn border border-line px-3 py-1.5 text-[13px] font-medium text-ink hover:bg-app"
            >
              Aujourd&apos;hui
            </Link>
            <Link
              href={`/admin/planning?from=${addDays(from, 14)}`}
              aria-label="Période suivante"
              className="rounded-btn border border-line px-2 py-1.5 text-body hover:bg-app"
            >
              <ChevronRight className="size-4" aria-hidden />
            </Link>
          </div>
        }
      />

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-[15px] font-semibold text-ink">
          {monthLabel(from)}
          <span className="ml-2 text-[12px] font-normal text-muted">
            {WINDOW_DAYS} jours
          </span>
        </h2>

        <ul className="flex flex-wrap gap-3 text-[11px] text-body" aria-label="Légende">
          {[
            ["En attente", "bg-warning"],
            ["Confirmée", "bg-success"],
            ["En cours", "bg-info"],
            ["Terminée", "bg-muted"],
            ["Annulée", "bg-danger"],
          ].map(([label, color]) => (
            <li key={label} className="flex items-center gap-1.5">
              <span aria-hidden className={cn("size-2 rounded-full", color)} />
              {label}
            </li>
          ))}
        </ul>
      </div>

      <PlanningGrid
        vehicles={vehicles.map((v) => ({
          id: v.id,
          name: v.name,
          licensePlate: v.licensePlate,
          category: v.category?.name ?? null,
        }))}
        bookings={bookings.map((b) => ({
          id: b.id,
          bookingNumber: b.bookingNumber,
          customerName: [b.customer.firstName, b.customer.lastName]
            .filter(Boolean)
            .join(" "),
          status: b.status,
          startDate: b.startDate.toISOString().slice(0, 10),
          endDate: b.endDate.toISOString().slice(0, 10),
          startTime: b.startTime,
          endTime: b.endTime,
          vehicleId: b.vehicleId,
        }))}
        days={days}
        today={today}
        canMove={can(session, "booking.edit")}
      />
    </>
  );
}

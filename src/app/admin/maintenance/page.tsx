import Link from "next/link";
import { MoreVertical, Plus, Wrench } from "lucide-react";
import { AccessDenied, PageHeader } from "@/components/admin/ui";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { formatDateOnly, formatXPF } from "@/lib/format";
import { can } from "@/server/auth/permissions";
import { requireSession } from "@/server/auth/session-context";
import { db } from "@/server/db";
import { withTenant } from "@/server/tenant-context";
import {
  MAINTENANCE_STATUS_DOT,
  MAINTENANCE_STATUS_LABELS,
  MAINTENANCE_TYPE_LABELS,
} from "@/lib/validation/maintenance";

export const metadata = { title: "Maintenance" };

export default async function MaintenancePage() {
  const session = await requireSession();

  if (!can(session, "maintenance.view")) {
    return (
      <>
        <PageHeader title="Maintenance" breadcrumb={["Accueil", "Maintenance"]} />
        <AccessDenied />
      </>
    );
  }

  const records = await withTenant(session.tenantId, () =>
    db.maintenance.findMany({
      orderBy: [{ performedAt: "desc" }, { id: "desc" }],
      take: 100,
      select: {
        id: true,
        title: true,
        type: true,
        status: true,
        cost: true,
        mileage: true,
        performedAt: true,
        nextDueDate: true,
        garage: true,
        vehicle: { select: { name: true, licensePlate: true } },
      },
    }),
  );

  const total = records.reduce((sum, r) => sum + r.cost, 0);

  return (
    <>
      <PageHeader
        title="Maintenance"
        breadcrumb={["Accueil", "Maintenance"]}
        actions={
          can(session, "maintenance.create") ? (
            <Link href="/admin/maintenance/new" className={cn(buttonVariants({}), "gap-2")}>
              <Plus className="size-4" aria-hidden />
              Ajouter une intervention
            </Link>
          ) : null
        }
      />

      <p className="mb-3 text-[13px] text-body">
        {records.length} intervention{records.length > 1 ? "s" : ""} · {formatXPF(total)} au total
      </p>

      <div className="rounded-card border border-line bg-surface">
        <table className="w-full border-collapse text-left">
          <thead>
            <tr className="border-b border-line">
              {["Véhicule", "Coût", "Kilométrage", "Date", "Prochaine échéance", "Statut"].map((label) => (
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
            {records.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-14 text-center">
                  <div className="mb-3 flex justify-center">
                    <span className="flex size-11 items-center justify-center rounded-full bg-brand-soft text-brand-text">
                      <Wrench className="size-5" aria-hidden />
                    </span>
                  </div>
                  <p className="text-sm font-semibold text-ink">Aucune maintenance</p>
                  <p className="mx-auto mt-1 max-w-md text-xs text-muted">
                    Les interventions planifiées apparaîtront ici : entretiens, réparations,
                    contrôles techniques.
                  </p>
                </td>
              </tr>
            ) : (
              records.map((record) => (
                <tr key={record.id} className="border-b border-line last:border-0">
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/maintenance/${record.id}`}
                      className="text-[13px] font-semibold text-ink hover:text-brand-text"
                    >
                      {record.title}
                    </Link>
                    <p className="text-[11px] text-muted">
                      {record.vehicle.name} · {record.vehicle.licensePlate} ·{" "}
                      {MAINTENANCE_TYPE_LABELS[record.type]}
                    </p>
                  </td>
                  <td className="px-4 py-3 text-[13px] font-medium text-ink">
                    {formatXPF(record.cost)}
                  </td>
                  <td className="px-4 py-3 text-[13px] text-body">
                    {record.mileage === null ? "—" : `${record.mileage.toLocaleString("fr-FR")} km`}
                  </td>
                  <td className="px-4 py-3 text-[13px] text-body">{formatDateOnly(record.performedAt)}</td>
                  <td className="px-4 py-3 text-[13px] text-body">{formatDateOnly(record.nextDueDate)}</td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-line px-2.5 py-0.5 text-[11px] font-medium text-ink">
                      <span
                        aria-hidden
                        className={cn("size-1.5 rounded-full", MAINTENANCE_STATUS_DOT[record.status])}
                      />
                      {MAINTENANCE_STATUS_LABELS[record.status]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/admin/maintenance/${record.id}`}
                      aria-label={`Modifier ${record.title}`}
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

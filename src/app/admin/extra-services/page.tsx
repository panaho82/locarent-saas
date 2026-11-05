import Link from "next/link";
import { MoreVertical, Plus } from "lucide-react";
import { AccessDenied, PageHeader } from "@/components/admin/ui";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { formatXPF } from "@/lib/format";
import { can } from "@/server/auth/permissions";
import { requireSession } from "@/server/auth/session-context";
import { db } from "@/server/db";
import { withTenant } from "@/server/tenant-context";

export const metadata = { title: "Services supplémentaires" };

const PRICE_TYPE_LABELS = { per_day: "Par jour", per_rental: "Unique" } as const;

export default async function ExtraServicesPage() {
  const session = await requireSession();

  if (!can(session, "vehicle.view")) {
    return (
      <>
        <PageHeader
          title="Services supplémentaires"
          breadcrumb={["Accueil", "Services supplémentaires"]}
        />
        <AccessDenied />
      </>
    );
  }

  const services = await withTenant(session.tenantId, () =>
    db.extraService.findMany({
      orderBy: [{ isActive: "desc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        description: true,
        price: true,
        priceType: true,
        isActive: true,
      },
    }),
  );

  return (
    <>
      <PageHeader
        title="Services supplémentaires"
        breadcrumb={["Accueil", "Services supplémentaires"]}
        actions={
          can(session, "vehicle.edit") ? (
            <Link href="/admin/extra-services/new" className={cn(buttonVariants({}), "gap-2")}>
              <Plus className="size-4" aria-hidden />
              Ajouter un service
            </Link>
          ) : null
        }
      />

      <p className="mb-3 text-[13px] text-body">
        {services.length} service{services.length > 1 ? "s" : ""}
      </p>

      <div className="rounded-card border border-line bg-surface">
        <table className="w-full border-collapse text-left">
          <thead>
            <tr className="border-b border-line">
              {["Nom", "Description", "Prix TTC", "Type", "Visibilité"].map((label) => (
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
            {services.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-14 text-center">
                  <p className="text-sm font-semibold text-ink">Aucun service supplémentaire</p>
                  <p className="mx-auto mt-1 max-w-md text-xs text-muted">
                    Proposez des options comme le GPS, siège enfant ou assurance à vos clients.
                  </p>
                  {can(session, "vehicle.edit") ? (
                    <Link
                      href="/admin/extra-services/new"
                      className="mt-4 inline-block text-[13px] font-medium text-brand-text hover:underline"
                    >
                      Ajouter un service
                    </Link>
                  ) : null}
                </td>
              </tr>
            ) : (
              services.map((service) => (
                <tr key={service.id} className="border-b border-line last:border-0">
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/extra-services/${service.id}`}
                      className="text-[13px] font-semibold text-ink hover:text-brand-text"
                    >
                      {service.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-[13px] text-body">{service.description ?? "—"}</td>
                  <td className="px-4 py-3 text-[13px] font-medium text-ink">
                    {formatXPF(service.price)}
                  </td>
                  <td className="px-4 py-3 text-[13px] text-body">
                    {PRICE_TYPE_LABELS[service.priceType]}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={cn(
                        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-medium",
                        service.isActive
                          ? "border-line text-ink"
                          : "border-line bg-app text-muted",
                      )}
                    >
                      <span
                        aria-hidden
                        className={cn(
                          "size-1.5 rounded-full",
                          service.isActive ? "bg-success" : "bg-muted",
                        )}
                      />
                      {service.isActive ? "Public" : "Interne"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/admin/extra-services/${service.id}`}
                      aria-label={`Modifier ${service.name}`}
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

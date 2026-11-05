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

export const metadata = { title: "Emplacements" };

export default async function LocationsPage() {
  const session = await requireSession();

  if (!can(session, "settings.view")) {
    return (
      <>
        <PageHeader title="Emplacements" breadcrumb={["Accueil", "Emplacements"]} />
        <AccessDenied />
      </>
    );
  }

  const locations = await withTenant(session.tenantId, () =>
    db.location.findMany({
      orderBy: [{ isDefault: "desc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        address: true,
        island: true,
        price: true,
        isFree: true,
        isDefault: true,
        isPublic: true,
        _count: { select: { vehicles: true } },
      },
    }),
  );

  return (
    <>
      <PageHeader
        title="Emplacements"
        breadcrumb={["Accueil", "Emplacements"]}
        actions={
          can(session, "settings.edit") ? (
            <Link href="/admin/locations/new" className={cn(buttonVariants({}), "gap-2")}>
              <Plus className="size-4" aria-hidden />
              Ajouter un emplacement
            </Link>
          ) : null
        }
      />

      <div className="rounded-card border border-line bg-surface">
        <table className="w-full border-collapse text-left">
          <thead>
            <tr className="border-b border-line">
              <th scope="col" className="px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.03em] text-ink">
                Nom
              </th>
              <th scope="col" className="px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.03em] text-ink">
                Adresse
              </th>
              <th scope="col" className="px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.03em] text-ink">
                Frais supplémentaire
              </th>
              <th scope="col" className="px-4 py-3">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {locations.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-14 text-center">
                  <p className="text-sm font-semibold text-ink">Aucun emplacement</p>
                  <p className="mt-1 text-xs text-muted">
                    Ajoutez l&apos;agence où vos clients viennent chercher leur véhicule.
                  </p>
                </td>
              </tr>
            ) : (
              locations.map((location) => (
                <tr key={location.id} className="border-b border-line last:border-0">
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/locations/${location.id}`}
                      className="text-[13px] font-semibold text-ink hover:text-brand-text"
                    >
                      {location.name}
                    </Link>
                    <div className="mt-0.5 flex gap-2 text-[11px] text-muted">
                      {location.isDefault ? <span>Par défaut</span> : null}
                      {location.island ? <span>· {location.island}</span> : null}
                      {!location.isPublic ? <span>· Interne</span> : null}
                      <span>· {location._count.vehicles} véhicule(s)</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-[13px] text-body">{location.address ?? "—"}</td>
                  <td className="px-4 py-3 text-[13px] text-body">
                    {location.isFree ? "Gratuit" : formatXPF(location.price)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/admin/locations/${location.id}`}
                      aria-label={`Modifier ${location.name}`}
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

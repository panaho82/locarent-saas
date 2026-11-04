import Link from "next/link";
import { MoreVertical, Plus, Search } from "lucide-react";
import { AccessDenied, PageHeader } from "@/components/admin/ui";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { formatRelative } from "@/lib/format";
import { VEHICLE_STATUS_DOT, VEHICLE_STATUS_LABELS } from "@/lib/vehicles";
import { can } from "@/server/auth/permissions";
import { requireSession } from "@/server/auth/session-context";
import { db } from "@/server/db";
import { withTenant } from "@/server/tenant-context";
import type { Prisma } from "@/generated/prisma/client";

export const metadata = { title: "Véhicules" };

const PAGE_SIZE = 10;

const SORTABLE = {
  name: "name",
  licensePlate: "licensePlate",
  dailyRate: "dailyRate",
  createdAt: "createdAt",
  status: "status",
} as const;

type SortKey = keyof typeof SORTABLE;

function isSortKey(value: string | undefined): value is SortKey {
  return value !== undefined && value in SORTABLE;
}

export default async function CarsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await requireSession();

  if (!can(session, "vehicle.view")) {
    return (
      <>
        <PageHeader title="Tous les véhicules" breadcrumb={["Accueil", "Tous les véhicules"]} />
        <AccessDenied />
      </>
    );
  }

  const params = await searchParams;
  const q = typeof params.q === "string" ? params.q.trim() : "";
  const sort: SortKey = isSortKey(typeof params.sort === "string" ? params.sort : undefined)
    ? (params.sort as SortKey)
    : "createdAt";
  const dir = params.dir === "asc" ? "asc" : "desc";
  const page = Math.max(1, Number(params.page) || 1);

  const where: Prisma.VehicleWhereInput = {
    ...(q
      ? {
          OR: [
            { name: { contains: q, mode: "insensitive" } },
            { licensePlate: { contains: q, mode: "insensitive" } },
            { model: { contains: q, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const { items, total } = await withTenant(session.tenantId, async () => {
    const [items, total] = await Promise.all([
      db.vehicle.findMany({
        where,
        orderBy: { [SORTABLE[sort]]: dir },
        skip: (page - 1) * PAGE_SIZE,
        take: PAGE_SIZE,
        select: {
          id: true,
          name: true,
          licensePlate: true,
          status: true,
          isActive: true,
          dailyRate: true,
          createdAt: true,
          category: { select: { name: true } },
          mainLocation: { select: { name: true } },
          images: { where: { isFeatured: true }, take: 1, select: { path: true } },
          _count: { select: { damages: { where: { repairedAt: null } } } },
        },
      }),
      db.vehicle.count({ where }),
    ]);
    return { items, total };
  });

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const link = (overrides: Record<string, string | number | undefined>) => {
    const sp = new URLSearchParams();
    if (q) sp.set("q", q);
    sp.set("sort", String(overrides.sort ?? sort));
    sp.set("dir", String(overrides.dir ?? dir));
    sp.set("page", String(overrides.page ?? page));
    return `/admin/cars?${sp.toString()}`;
  };

  const sortLink = (key: SortKey) =>
    link({ sort: key, dir: sort === key && dir === "asc" ? "desc" : "asc", page: 1 });

  return (
    <>
      <PageHeader
        title="Tous les véhicules"
        breadcrumb={["Accueil", "Tous les véhicules"]}
        actions={
          can(session, "vehicle.create") ? (
            <Link href="/admin/cars/new" className={cn(buttonVariants({}), "gap-2")}>
              <Plus className="size-4" aria-hidden />
              Ajouter un véhicule
            </Link>
          ) : null
        }
      />

      <div className="mb-4 flex justify-end">
        <form action="/admin/cars" className="w-full max-w-[280px]">
          <div className="relative">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted"
              aria-hidden
            />
            <input
              type="search"
              name="q"
              defaultValue={q}
              placeholder="Rechercher"
              aria-label="Rechercher un véhicule"
              className="h-10 w-full rounded-btn border border-line bg-surface pl-9 pr-3 text-sm text-ink placeholder:text-muted"
            />
          </div>
        </form>
      </div>

      <div className="rounded-card border border-line bg-surface">
        <table className="w-full border-collapse text-left">
          <thead>
            <tr className="border-b border-line">
              {[
                ["Véhicule", "name"],
                ["Immatriculation", "licensePlate"],
                ["Emplacement", null],
                ["Prix (par jour)", "dailyRate"],
                ["Dommages", null],
                ["Date création", "createdAt"],
                ["Statut", "status"],
              ].map(([label, key]) => (
                <th
                  key={label as string}
                  scope="col"
                  className="px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.03em] text-ink"
                >
                  {key ? (
                    <Link
                      href={sortLink(key as SortKey)}
                      className="inline-flex items-center gap-1 hover:text-brand-text"
                    >
                      {label}
                      <span aria-hidden className="text-muted">
                        {sort === key ? (dir === "asc" ? "↑" : "↓") : "↕"}
                      </span>
                    </Link>
                  ) : (
                    label
                  )}
                </th>
              ))}
              <th scope="col" className="px-4 py-3">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-16 text-center">
                  <p className="text-sm font-semibold text-ink">Aucun véhicule</p>
                  <p className="mt-1 text-xs text-muted">
                    {q
                      ? "Aucun résultat pour cette recherche."
                      : "Ajoutez votre premier véhicule pour commencer."}
                  </p>
                </td>
              </tr>
            ) : (
              items.map((vehicle) => {
                const status = vehicle.isActive ? vehicle.status : "inactive";
                return (
                  <tr key={vehicle.id} className="border-b border-line last:border-0">
                    <td className="px-4 py-3">
                      <Link href={`/admin/cars/${vehicle.id}`} className="flex items-center gap-3">
                        <span className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-btn bg-brand-soft text-[15px]">
                          {vehicle.images[0]?.path ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={vehicle.images[0].path}
                              alt=""
                              className="size-full object-cover"
                            />
                          ) : (
                            "🚗"
                          )}
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate text-[13px] font-semibold text-ink">
                            {vehicle.name}
                          </span>
                          <span className="block truncate text-[11px] text-muted">
                            {vehicle.category?.name ?? "—"}
                          </span>
                        </span>
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-[13px] text-body">{vehicle.licensePlate}</td>
                    <td className="px-4 py-3 text-[13px] text-body">
                      {vehicle.mainLocation?.name ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-[13px] font-medium text-ink">
                      {vehicle.dailyRate}
                    </td>
                    <td className="px-4 py-3 text-[13px] text-body">
                      {vehicle._count.damages}
                    </td>
                    <td className="px-4 py-3 text-[13px] text-body">
                      {formatRelative(vehicle.createdAt)}
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-line px-2.5 py-0.5 text-[11px] font-medium text-ink">
                        <span
                          aria-hidden
                          className={cn("size-1.5 rounded-full", VEHICLE_STATUS_DOT[status])}
                        />
                        {VEHICLE_STATUS_LABELS[status]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/admin/cars/${vehicle.id}`}
                        aria-label={`Actions sur ${vehicle.name}`}
                        className="inline-flex rounded-btn p-1.5 text-muted hover:bg-app hover:text-ink"
                      >
                        <MoreVertical className="size-4" aria-hidden />
                      </Link>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-[13px] text-body">
          {total} entrée{total > 1 ? "s" : ""} au total
        </p>
        {pageCount > 1 ? (
          <nav aria-label="Pagination" className="flex items-center gap-1">
            <Link
              href={link({ page: Math.max(1, page - 1) })}
              aria-disabled={page === 1}
              className={cn(
                "rounded-btn border border-line px-2.5 py-1.5 text-[13px]",
                page === 1 ? "pointer-events-none opacity-40" : "hover:bg-app",
              )}
            >
              ‹
            </Link>
            {Array.from({ length: pageCount }, (_, i) => i + 1)
              .filter((n) => Math.abs(n - page) <= 2 || n === 1 || n === pageCount)
              .map((n) => (
                <Link
                  key={n}
                  href={link({ page: n })}
                  aria-current={n === page ? "page" : undefined}
                  className={cn(
                    "min-w-8 rounded-btn border px-2.5 py-1.5 text-center text-[13px]",
                    n === page
                      ? "border-brand bg-brand font-semibold text-ink"
                      : "border-line hover:bg-app",
                  )}
                >
                  {n}
                </Link>
              ))}
            <Link
              href={link({ page: Math.min(pageCount, page + 1) })}
              aria-disabled={page === pageCount}
              className={cn(
                "rounded-btn border border-line px-2.5 py-1.5 text-[13px]",
                page === pageCount ? "pointer-events-none opacity-40" : "hover:bg-app",
              )}
            >
              ›
            </Link>
          </nav>
        ) : null}
      </div>
    </>
  );
}

import Link from "next/link";
import { Filter, MoreVertical, Plus } from "lucide-react";
import { AccessDenied, PageHeader } from "@/components/admin/ui";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { can } from "@/server/auth/permissions";
import { requireSession } from "@/server/auth/session-context";
import { db } from "@/server/db";
import { withTenant } from "@/server/tenant-context";
import { displayName } from "@/lib/validation/customer";

export const metadata = { title: "Clients" };

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await requireSession();

  if (!can(session, "customer.view")) {
    return (
      <>
        <PageHeader title="Clients" breadcrumb={["Accueil", "Clients"]} />
        <AccessDenied />
      </>
    );
  }

  const params = await searchParams;
  const tab = params.tab === "companies" ? "companies" : "clients";
  const q = typeof params.q === "string" ? params.q.trim() : "";
  const sort = params.sort === "name" ? "name" : "createdAt";

  const data = await withTenant(session.tenantId, async () => {
    if (tab === "companies") {
      return {
        tab,
        total: await db.company.count(),
        companies: await db.company.findMany({
          where: q
            ? {
                OR: [
                  { name: { contains: q, mode: "insensitive" as const } },
                  { email: { contains: q, mode: "insensitive" as const } },
                ],
              }
            : {},
          orderBy: sort === "name" ? { name: "asc" } : { createdAt: "desc" },
          take: 50,
          select: {
            id: true,
            name: true,
            contactName: true,
            email: true,
            phone: true,
            city: true,
            _count: { select: { bookings: true } },
          },
        }),
        customers: [],
      };
    }

    return {
      tab,
      total: await db.customer.count(),
      customers: await db.customer.findMany({
        where: q
          ? {
              OR: [
                { firstName: { contains: q, mode: "insensitive" as const } },
                { lastName: { contains: q, mode: "insensitive" as const } },
                { email: { contains: q, mode: "insensitive" as const } },
                { phone: { contains: q } },
              ],
            }
          : {},
        orderBy: sort === "name" ? { lastName: "asc" } : { createdAt: "desc" },
        take: 50,
        select: {
          id: true,
          firstName: true,
          lastName: true,
          isInsurance: true,
          email: true,
          phone: true,
          phoneCode: true,
          _count: { select: { bookings: true, documents: true, drivers: true } },
        },
      }),
      companies: [],
    };
  });

  return (
    <>
      <PageHeader
        title="Clients"
        breadcrumb={["Accueil", "Clients"]}
        actions={
          can(session, "customer.create") ? (
            <Link
              href={tab === "companies" ? "/admin/companies/new" : "/admin/customers/new"}
              className={cn(buttonVariants({}), "gap-2")}
            >
              <Plus className="size-4" aria-hidden />
              {tab === "companies" ? "Ajouter une entreprise" : "Ajouter un client"}
            </Link>
          ) : null
        }
      />

      {/* Onglets Clients / Entreprises */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <nav className="flex gap-1 rounded-btn border border-line bg-surface p-1" aria-label="Type de client">
          {[
            ["clients", "Clients"],
            ["companies", "Entreprises"],
          ].map(([key, label]) => (
            <Link
              key={key}
              href={`/admin/customers${key === "companies" ? "?tab=companies" : ""}`}
              aria-current={tab === key ? "page" : undefined}
              className={cn(
                "rounded-btn px-3 py-1.5 text-[13px] font-medium",
                tab === key ? "bg-brand-soft text-brand-text" : "text-body hover:text-ink",
              )}
            >
              {label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <form action="/admin/customers" className="flex items-center gap-2">
            {tab === "companies" ? <input type="hidden" name="tab" value="companies" /> : null}
            <input
              type="search"
              name="q"
              defaultValue={q}
              placeholder="Rechercher"
              aria-label="Rechercher un client"
              className="h-9 w-[200px] rounded-btn border border-line bg-surface px-3 text-[13px] text-ink placeholder:text-muted"
            />
            <input type="hidden" name="sort" value={sort} />
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 rounded-btn border border-line bg-surface px-3 py-1.5 text-[13px] text-body hover:text-ink"
            >
              <Filter className="size-3.5" aria-hidden />
              Filtrer
            </button>
          </form>
        </div>
      </div>

      <div className="mb-3 flex items-center justify-between text-[13px] text-body">
        <span>
          Trier par :{" "}
          <Link
            href={`/admin/customers?${new URLSearchParams({
              ...(tab === "companies" ? { tab: "companies" } : {}),
              ...(q ? { q } : {}),
              sort: "createdAt",
            })}`}
            className={cn("hover:underline", sort === "createdAt" && "font-semibold text-ink")}
          >
            Plus récent
          </Link>{" "}
          ·{" "}
          <Link
            href={`/admin/customers?${new URLSearchParams({
              ...(tab === "companies" ? { tab: "companies" } : {}),
              ...(q ? { q } : {}),
              sort: "name",
            })}`}
            className={cn("hover:underline", sort === "name" && "font-semibold text-ink")}
          >
            Nom
          </Link>
        </span>
        <span>{data.total} entrée{data.total > 1 ? "s" : ""} au total</span>
      </div>

      <div className="rounded-card border border-line bg-surface">
        <table className="w-full border-collapse text-left">
          <thead>
            <tr className="border-b border-line">
              {(tab === "companies"
                ? ["Entreprise", "Coordonnées", "Email", "Locations"]
                : ["Client", "Type", "E-mail", "Documents", "Locations"]
              ).map((label) => (
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
            {tab === "clients" && data.customers.length > 0
              ? data.customers.map((customer) => (
                  <tr key={customer.id} className="border-b border-line last:border-0">
                    <td className="px-4 py-3">
                      <Link
                        href={`/admin/customers/${customer.id}`}
                        className="text-[13px] font-semibold text-ink hover:text-brand-text"
                      >
                        {displayName(customer.firstName, customer.lastName)}
                      </Link>
                      <p className="text-[11px] text-muted">
                        {customer.phone ? `${customer.phoneCode ?? ""} ${customer.phone}`.trim() : "—"}
                        {customer._count.drivers > 0 ? ` · ${customer._count.drivers} conducteur(s)` : ""}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-[13px] text-body">
                      {customer.isInsurance ? "Assurance" : "Particulier"}
                    </td>
                    <td className="px-4 py-3 text-[13px] text-body">{customer.email ?? "—"}</td>
                    <td className="px-4 py-3 text-[13px] text-body">
                      {customer._count.documents === 0
                        ? "Aucun document"
                        : `${customer._count.documents} document(s)`}
                    </td>
                    <td className="px-4 py-3 text-[13px] text-body">
                      {customer._count.bookings} Location(s)
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/admin/customers/${customer.id}`}
                        aria-label={`Ouvrir ${displayName(customer.firstName, customer.lastName)}`}
                        className="inline-flex rounded-btn p-1.5 text-muted hover:bg-app hover:text-ink"
                      >
                        <MoreVertical className="size-4" aria-hidden />
                      </Link>
                    </td>
                  </tr>
                ))
              : null}

            {tab === "companies" && data.companies.length > 0
              ? data.companies.map((company) => (
                  <tr key={company.id} className="border-b border-line last:border-0">
                    <td className="px-4 py-3">
                      <Link
                        href={`/admin/companies/${company.id}`}
                        className="text-[13px] font-semibold text-ink hover:text-brand-text"
                      >
                        {company.name}
                      </Link>
                      {company.contactName ? (
                        <p className="text-[11px] text-muted">{company.contactName}</p>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 text-[13px] text-body">
                      {[company.phone, company.city].filter(Boolean).join(" · ") || "—"}
                    </td>
                    <td className="px-4 py-3 text-[13px] text-body">{company.email ?? "—"}</td>
                    <td className="px-4 py-3 text-[13px] text-body">
                      {company._count.bookings} Location(s)
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/admin/companies/${company.id}`}
                        aria-label={`Ouvrir ${company.name}`}
                        className="inline-flex rounded-btn p-1.5 text-muted hover:bg-app hover:text-ink"
                      >
                        <MoreVertical className="size-4" aria-hidden />
                      </Link>
                    </td>
                  </tr>
                ))
              : null}

            {(tab === "clients" ? data.customers.length : data.companies.length) === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-14 text-center">
                  <p className="text-sm font-semibold text-ink">Aucun résultat trouvé</p>
                  <p className="mt-1 text-xs text-muted">
                    {q
                      ? "Aucun client ne correspond à cette recherche."
                      : tab === "companies"
                        ? "Ajoutez une entreprise pour la facturer."
                        : "Ajoutez votre premier client pour commencer."}
                  </p>
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </>
  );
}

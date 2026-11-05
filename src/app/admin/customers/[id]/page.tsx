import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/admin/ui";
import { CustomerForm, type CustomerValues } from "@/components/admin/customer-form";
import { DriverManager } from "@/components/admin/driver-manager";
import { cn } from "@/lib/cn";
import { formatDate } from "@/lib/format";
import { can } from "@/server/auth/permissions";
import { requireSession } from "@/server/auth/session-context";
import { db } from "@/server/db";
import { withTenant } from "@/server/tenant-context";
import { displayName } from "@/lib/validation/customer";

const TABS = [
  ["apercu", "Aperçu"],
  ["conducteurs", "Conducteurs"],
  ["modifier", "Modifier"],
] as const;

export default async function CustomerDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await requireSession();
  const { id } = await params;
  const { tab: rawTab } = await searchParams;
  const customerId = Number(id);
  if (!Number.isInteger(customerId)) notFound();

  const tab = TABS.some(([key]) => key === rawTab) ? (rawTab as string) : "apercu";

  const customer = await withTenant(session.tenantId, () =>
    db.customer.findFirst({
      where: { id: customerId },
      include: {
        drivers: { orderBy: [{ isMain: "desc" }, { lastName: "asc" }] },
        _count: { select: { bookings: true, documents: true } },
      },
    }),
  );
  if (!customer) notFound();

  const name = displayName(customer.firstName, customer.lastName);

  const values: CustomerValues = {
    id: customer.id,
    firstName: customer.firstName ?? "",
    lastName: customer.lastName ?? "",
    email: customer.email ?? "",
    phone: customer.phone ?? "",
    address: customer.address ?? "",
    zipcode: customer.zipcode ?? "",
    city: customer.city ?? "",
    country: customer.country ?? "Polynésie française",
    notes: customer.notes ?? "",
    isInsurance: customer.isInsurance,
  };

  return (
    <>
      <PageHeader
        title={name}
        breadcrumb={["Accueil", "Clients", name]}
        actions={
          <span className="rounded-full border border-line px-3 py-1 text-[11px] font-medium text-body">
            {customer.isInsurance ? "Assurance" : "Particulier"}
          </span>
        }
      />

      <p className="mb-4 text-[13px] text-body">
        Ajouté le {formatDate(customer.createdAt)} · {customer._count.bookings} location(s) ·{" "}
        {customer.drivers.length} conducteur(s)
      </p>

      <nav className="mb-4 flex gap-1 rounded-btn border border-line bg-surface p-1" aria-label="Sections du client">
        {TABS.map(([key, label]) => (
          <Link
            key={key}
            href={`/admin/customers/${customer.id}${key === "apercu" ? "" : `?tab=${key}`}`}
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

      {tab === "apercu" ? (
        <div className="grid gap-4 lg:grid-cols-3">
          <section className="rounded-card border border-line bg-surface p-5 lg:col-span-2">
            <h2 className="mb-4 text-sm font-semibold text-ink">Informations générales</h2>
            <dl className="grid gap-4 sm:grid-cols-2">
              {[
                ["Téléphone", `${customer.phoneCode ?? ""} ${customer.phone ?? "—"}`.trim()],
                ["Email", customer.email ?? "—"],
                [
                  "Adresse",
                  [customer.address, customer.city, customer.zipcode, customer.country]
                    .filter(Boolean)
                    .join(", ") || "—",
                ],
                ["Conducteurs", `${customer.drivers.length}`],
              ].map(([label, value]) => (
                <div key={label}>
                  <dt className="text-[11px] font-medium uppercase tracking-wide text-muted">{label}</dt>
                  <dd className="mt-0.5 text-[13px] text-ink">{value}</dd>
                </div>
              ))}
            </dl>
            {customer.notes ? (
              <div className="mt-5 border-t border-line pt-4">
                <p className="text-[11px] font-medium uppercase tracking-wide text-muted">Notes internes</p>
                <p className="mt-1 whitespace-pre-line text-[13px] text-body">{customer.notes}</p>
              </div>
            ) : null}
          </section>

          <section className="rounded-card border border-line bg-surface p-5">
            <h2 className="mb-1 text-sm font-semibold text-ink">Documents</h2>
            <p className="mb-4 text-[12px] text-muted">
              Permis, pièce d&apos;identité, justificatifs.
            </p>
            <p className="text-[13px] text-body">
              {customer._count.documents === 0
                ? "Aucun document téléversé"
                : `${customer._count.documents} document(s)`}
            </p>
            <p className="mt-3 text-[11px] text-muted">
              Le téléversement arrive avec le check-in (lot 3) : il faut le stockage objet
              pour héberger des pièces d&apos;identité.
            </p>
          </section>
        </div>
      ) : null}

      {tab === "conducteurs" ? (
        <DriverManager
          customerId={customer.id}
          canEdit={can(session, "driver.create")}
          drivers={customer.drivers.map((d) => ({
            id: d.id,
            firstName: d.firstName,
            lastName: d.lastName,
            licenseCardNumber: d.licenseCardNumber,
            licenseExpiresAt: d.licenseExpiresAt?.toISOString() ?? null,
            isMain: d.isMain,
          }))}
        />
      ) : null}

      {tab === "modifier" ? (
        can(session, "customer.edit") ? (
          <CustomerForm mode="edit" values={values} />
        ) : (
          <p className="text-sm text-body">Votre rôle ne permet pas de modifier ce client.</p>
        )
      ) : null}
    </>
  );
}

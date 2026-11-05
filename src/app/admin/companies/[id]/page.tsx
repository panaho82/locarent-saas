import { notFound } from "next/navigation";
import { PageHeader } from "@/components/admin/ui";
import {
  ClientCompanyForm,
  type ClientCompanyValues,
} from "@/components/admin/client-company-form";
import { can } from "@/server/auth/permissions";
import { requireSession } from "@/server/auth/session-context";
import { db } from "@/server/db";
import { withTenant } from "@/server/tenant-context";

export default async function EditCompanyPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireSession();
  const { id } = await params;
  const companyId = Number(id);
  if (!Number.isInteger(companyId)) notFound();

  const company = await withTenant(session.tenantId, () =>
    db.company.findFirst({ where: { id: companyId } }),
  );
  if (!company) notFound();

  const values: ClientCompanyValues = {
    id: company.id,
    name: company.name,
    contactName: company.contactName ?? "",
    email: company.email ?? "",
    phone: company.phone ?? "",
    address: company.address ?? "",
    zipcode: company.zipcode ?? "",
    city: company.city ?? "",
    country: company.country ?? "Polynésie française",
    taxId: company.taxId ?? "",
    notes: company.notes ?? "",
  };

  return (
    <>
      <PageHeader
        title={company.name}
        breadcrumb={["Accueil", "Clients", "Entreprises", company.name]}
      />
      {can(session, "customer.edit") ? (
        <ClientCompanyForm mode="edit" values={values} />
      ) : (
        <p className="text-sm text-body">Votre rôle ne permet pas de modifier cette entreprise.</p>
      )}
    </>
  );
}

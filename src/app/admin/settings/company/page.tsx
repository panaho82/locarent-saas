import { PageHeader } from "@/components/admin/ui";
import { Card } from "@/components/ui/card";
import {
  CompanyForm,
  type CompanyValues,
} from "@/components/admin/company-form";
import { can } from "@/server/auth/permissions";
import { requireSession } from "@/server/auth/session-context";
import { withTenant } from "@/server/tenant-context";
import { db } from "@/server/db";

export const metadata = { title: "Entreprise" };

export default async function CompanySettingsPage() {
  const session = await requireSession();

  const tenant = await withTenant(session.tenantId, () =>
    db.tenant.findUniqueOrThrow({
      where: { id: session.tenantId },
      include: { settings: true },
    }),
  );

  const values: CompanyValues = {
    name: tenant.name,
    managerName: tenant.managerName ?? "",
    email: tenant.email,
    phone: tenant.phone ?? "",
    tahitiNumber: tenant.tahitiNumber ?? "",
    address: tenant.address ?? "",
    city: tenant.city ?? "",
    zipcode: tenant.zipcode ?? "",
    island: tenant.island ?? "",
    companyTagline: tenant.settings?.companyTagline ?? "",
    primaryColor: tenant.settings?.primaryColor ?? "#2563eb",
  };

  return (
    <>
      <PageHeader
        title="Entreprise"
        breadcrumb={["Accueil", "Réglages", "Entreprise"]}
        description="Ces informations apparaissent sur vos factures, vos contrats et votre page de réservation."
      />
      <Card>
        <CompanyForm values={values} canEdit={can(session, "settings.edit")} />
      </Card>
    </>
  );
}

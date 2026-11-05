import { PageHeader } from "@/components/admin/ui";
import {
  ClientCompanyForm,
  type ClientCompanyValues,
} from "@/components/admin/client-company-form";
import { requireSession } from "@/server/auth/session-context";

export const metadata = { title: "Ajouter une entreprise" };

const EMPTY: ClientCompanyValues = {
  name: "",
  contactName: "",
  email: "",
  phone: "",
  address: "",
  zipcode: "",
  city: "",
  country: "Polynésie française",
  taxId: "",
  notes: "",
};

export default async function NewCompanyPage() {
  await requireSession();
  return (
    <>
      <PageHeader
        title="Ajouter une entreprise"
        breadcrumb={["Accueil", "Clients", "Entreprises", "Ajouter"]}
      />
      <ClientCompanyForm mode="create" values={EMPTY} />
    </>
  );
}

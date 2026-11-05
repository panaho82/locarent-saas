import { PageHeader } from "@/components/admin/ui";
import { CustomerForm, type CustomerValues } from "@/components/admin/customer-form";
import { requireSession } from "@/server/auth/session-context";

export const metadata = { title: "Ajouter un client" };

const EMPTY: CustomerValues = {
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  address: "",
  zipcode: "",
  city: "",
  country: "Polynésie française",
  notes: "",
  isInsurance: false,
};

export default async function NewCustomerPage() {
  await requireSession();
  return (
    <>
      <PageHeader title="Ajouter un client" breadcrumb={["Accueil", "Clients", "Ajouter"]} />
      <CustomerForm mode="create" values={EMPTY} />
    </>
  );
}

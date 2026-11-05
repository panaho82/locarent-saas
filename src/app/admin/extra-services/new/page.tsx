import { PageHeader } from "@/components/admin/ui";
import {
  ExtraServiceForm,
  type ExtraServiceValues,
} from "@/components/admin/extra-service-form";
import { requireSession } from "@/server/auth/session-context";

export const metadata = { title: "Ajouter un service" };

const EMPTY: ExtraServiceValues = {
  name: "",
  description: "",
  price: "",
  priceType: "per_rental",
  maxQty: "",
  isActive: true,
};

export default async function NewExtraServicePage() {
  await requireSession();
  return (
    <>
      <PageHeader
        title="Ajouter un service"
        breadcrumb={["Accueil", "Services supplémentaires", "Ajouter"]}
      />
      <ExtraServiceForm mode="create" values={EMPTY} />
    </>
  );
}

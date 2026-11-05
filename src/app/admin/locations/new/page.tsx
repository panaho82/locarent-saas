import { PageHeader } from "@/components/admin/ui";
import { LocationForm, type LocationValues } from "@/components/admin/location-form";
import { requireSession } from "@/server/auth/session-context";

export const metadata = { title: "Ajouter un emplacement" };

const EMPTY: LocationValues = {
  name: "",
  address: "",
  island: "",
  openingHours: "",
  price: "",
  isFree: true,
  isPublic: true,
  isDefault: false,
};

export default async function NewLocationPage() {
  await requireSession();
  return (
    <>
      <PageHeader
        title="Ajouter un emplacement"
        breadcrumb={["Accueil", "Emplacements", "Ajouter"]}
      />
      <LocationForm mode="create" values={EMPTY} />
    </>
  );
}

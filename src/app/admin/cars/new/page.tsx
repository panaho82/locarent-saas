import { PageHeader } from "@/components/admin/ui";
import { VehicleForm, type VehicleFormValues } from "@/components/admin/vehicle-form";
import { requireSession } from "@/server/auth/session-context";
import { loadVehicleFormOptions } from "@/server/queries/vehicle-form";

export const metadata = { title: "Ajouter un véhicule" };

const EMPTY: VehicleFormValues = {
  name: "",
  make: "",
  brandId: "",
  model: "",
  licensePlate: "",
  categoryId: "",
  colorSlug: "",
  year: "",
  mileage: "",
  seats: "",
  fuelType: "",
  transmissionType: "",
  nextTechnicalControlDate: "",
  mainLocationId: "",
  dailyRate: "",
  weeklyRate: "",
  monthlyRate: "",
  baseKilometers: "",
  extraKmPrice: "",
  isUnlimitedKilometers: true,
};

export default async function NewCarPage() {
  const session = await requireSession();
  const options = await loadVehicleFormOptions(session.tenantId);

  return (
    <>
      <PageHeader title="Ajouter un véhicule" breadcrumb={["Accueil", "Véhicules", "Ajouter"]} />
      <VehicleForm mode="create" values={EMPTY} options={options} />
    </>
  );
}

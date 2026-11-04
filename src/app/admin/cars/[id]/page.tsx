import { notFound } from "next/navigation";
import { PageHeader } from "@/components/admin/ui";
import { VehicleForm, type VehicleFormValues } from "@/components/admin/vehicle-form";
import { requireSession } from "@/server/auth/session-context";
import { db } from "@/server/db";
import { loadVehicleFormOptions } from "@/server/queries/vehicle-form";
import { withTenant } from "@/server/tenant-context";

export default async function EditCarPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireSession();
  const { id } = await params;
  const vehicleId = Number(id);
  if (!Number.isInteger(vehicleId)) notFound();

  const vehicle = await withTenant(session.tenantId, () =>
    db.vehicle.findFirst({ where: { id: vehicleId } }),
  );
  if (!vehicle) notFound();

  const options = await loadVehicleFormOptions(session.tenantId);

  const toInput = (value: string | number | null | undefined) =>
    value === null || value === undefined ? "" : String(value);

  const values: VehicleFormValues = {
    id: vehicle.id,
    name: vehicle.name,
    make: vehicle.make ?? "",
    brandId: toInput(vehicle.brandId),
    model: vehicle.model ?? "",
    licensePlate: vehicle.licensePlate,
    categoryId: toInput(vehicle.categoryId),
    colorSlug: vehicle.colorSlug ?? "",
    year: toInput(vehicle.year),
    mileage: toInput(vehicle.mileage),
    seats: toInput(vehicle.seats),
    fuelType: vehicle.fuelType ?? "",
    transmissionType: vehicle.transmissionType ?? "",
    nextTechnicalControlDate: vehicle.nextTechnicalControlDate
      ? vehicle.nextTechnicalControlDate.toISOString().slice(0, 10)
      : "",
    mainLocationId: toInput(vehicle.mainLocationId),
    dailyRate: toInput(vehicle.dailyRate),
    weeklyRate: toInput(vehicle.weeklyRate),
    monthlyRate: toInput(vehicle.monthlyRate),
    baseKilometers: toInput(vehicle.baseKilometers),
    extraKmPrice: toInput(vehicle.extraKmPrice),
    isUnlimitedKilometers: vehicle.baseKilometers === null,
  };

  return (
    <>
      <PageHeader
        title={vehicle.name}
        breadcrumb={["Accueil", "Véhicules", vehicle.licensePlate]}
      />
      <VehicleForm mode="edit" values={values} options={options} />
    </>
  );
}

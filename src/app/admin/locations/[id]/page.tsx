import { notFound } from "next/navigation";
import { PageHeader } from "@/components/admin/ui";
import { LocationForm, type LocationValues } from "@/components/admin/location-form";
import { requireSession } from "@/server/auth/session-context";
import { db } from "@/server/db";
import { withTenant } from "@/server/tenant-context";

export default async function EditLocationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireSession();
  const { id } = await params;
  const locationId = Number(id);
  if (!Number.isInteger(locationId)) notFound();

  const location = await withTenant(session.tenantId, () =>
    db.location.findFirst({ where: { id: locationId } }),
  );
  if (!location) notFound();

  const values: LocationValues = {
    id: location.id,
    name: location.name,
    address: location.address ?? "",
    island: location.island ?? "",
    openingHours: location.openingHours ?? "",
    price: location.price === null ? "" : String(location.price),
    isFree: location.isFree,
    isPublic: location.isPublic,
    isDefault: location.isDefault,
  };

  return (
    <>
      <PageHeader
        title={location.name}
        breadcrumb={["Accueil", "Emplacements", location.name]}
      />
      <LocationForm mode="edit" values={values} />
    </>
  );
}

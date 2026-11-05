import { PageHeader } from "@/components/admin/ui";
import {
  MaintenanceForm,
  type MaintenanceValues,
} from "@/components/admin/maintenance-form";
import { requireSession } from "@/server/auth/session-context";
import { db } from "@/server/db";
import { withTenant } from "@/server/tenant-context";

export const metadata = { title: "Ajouter une intervention" };

const EMPTY: MaintenanceValues = {
  vehicleId: "",
  type: "service",
  status: "planned",
  title: "",
  description: "",
  cost: "",
  mileage: "",
  performedAt: "",
  nextDueDate: "",
  nextDueMileage: "",
  garage: "",
};

export default async function NewMaintenancePage() {
  const session = await requireSession();
  const vehicles = await withTenant(session.tenantId, () =>
    db.vehicle.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true, licensePlate: true },
    }),
  );

  return (
    <>
      <PageHeader
        title="Ajouter une intervention"
        breadcrumb={["Accueil", "Maintenance", "Ajouter"]}
      />
      <MaintenanceForm mode="create" values={EMPTY} vehicles={vehicles} />
    </>
  );
}

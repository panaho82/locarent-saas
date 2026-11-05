import { notFound } from "next/navigation";
import { PageHeader } from "@/components/admin/ui";
import {
  MaintenanceForm,
  type MaintenanceValues,
} from "@/components/admin/maintenance-form";
import { requireSession } from "@/server/auth/session-context";
import { db } from "@/server/db";
import { withTenant } from "@/server/tenant-context";

export default async function EditMaintenancePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireSession();
  const { id } = await params;
  const maintenanceId = Number(id);
  if (!Number.isInteger(maintenanceId)) notFound();

  const [record, vehicles] = await withTenant(session.tenantId, async () => {
    const [record, vehicles] = await Promise.all([
      db.maintenance.findFirst({ where: { id: maintenanceId } }),
      db.vehicle.findMany({
        orderBy: { name: "asc" },
        select: { id: true, name: true, licensePlate: true },
      }),
    ]);
    return [record, vehicles] as const;
  });
  if (!record) notFound();

  const iso = (value: Date | null) => (value ? value.toISOString().slice(0, 10) : "");

  const values: MaintenanceValues = {
    id: record.id,
    vehicleId: String(record.vehicleId),
    type: record.type,
    status: record.status,
    title: record.title,
    description: record.description ?? "",
    cost: String(record.cost),
    mileage: record.mileage === null ? "" : String(record.mileage),
    performedAt: iso(record.performedAt),
    nextDueDate: iso(record.nextDueDate),
    nextDueMileage: record.nextDueMileage === null ? "" : String(record.nextDueMileage),
    garage: record.garage ?? "",
  };

  return (
    <>
      <PageHeader
        title={record.title}
        breadcrumb={["Accueil", "Maintenance", record.title]}
      />
      <MaintenanceForm mode="edit" values={values} vehicles={vehicles} />
    </>
  );
}

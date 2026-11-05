import { notFound } from "next/navigation";
import { PageHeader } from "@/components/admin/ui";
import {
  ExtraServiceForm,
  type ExtraServiceValues,
} from "@/components/admin/extra-service-form";
import { requireSession } from "@/server/auth/session-context";
import { db } from "@/server/db";
import { withTenant } from "@/server/tenant-context";

export default async function EditExtraServicePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireSession();
  const { id } = await params;
  const serviceId = Number(id);
  if (!Number.isInteger(serviceId)) notFound();

  const service = await withTenant(session.tenantId, () =>
    db.extraService.findFirst({ where: { id: serviceId } }),
  );
  if (!service) notFound();

  const values: ExtraServiceValues = {
    id: service.id,
    name: service.name,
    description: service.description ?? "",
    price: String(service.price),
    priceType: service.priceType,
    maxQty: service.maxQty === null ? "" : String(service.maxQty),
    isActive: service.isActive,
  };

  return (
    <>
      <PageHeader
        title={service.name}
        breadcrumb={["Accueil", "Services supplémentaires", service.name]}
      />
      <ExtraServiceForm mode="edit" values={values} />
    </>
  );
}

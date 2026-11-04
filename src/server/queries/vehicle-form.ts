import { db } from "@/server/db";
import { withTenant } from "@/server/tenant-context";
import type { VehicleFormOptions } from "@/components/admin/vehicle-form";

/**
 * Données de référence du formulaire véhicule : marques et couleurs sont
 * globales, catégories et lieux appartiennent à l'agence.
 */
export async function loadVehicleFormOptions(
  tenantId: number,
): Promise<VehicleFormOptions> {
  return withTenant(tenantId, async () => {
    const [brands, categories, colors, locations] = await Promise.all([
      db.brand.findMany({
        where: { isVisible: true },
        orderBy: { name: "asc" },
        select: { id: true, name: true },
      }),
      db.vehicleCategory.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
      db.color.findMany({ orderBy: { name: "asc" }, select: { slug: true, name: true } }),
      db.location.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    ]);
    return { brands, categories, colors, locations };
  });
}

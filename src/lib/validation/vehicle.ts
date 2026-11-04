import { z } from "zod";
import { FUEL_TYPES, TRANSMISSIONS } from "@/lib/vehicles";

/**
 * Validation du formulaire véhicule.
 *
 * ⚠️ `formData.get()` renvoie `null` pour un champ absent du DOM. Les schémas
 * utilisent donc `.nullish()` et non `.optional()` : sinon une erreur de
 * validation porterait sur un champ non affiché, et l'utilisateur verrait un
 * formulaire qui « ne fait rien ».
 */

const text = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullish()
    .transform((v) => (v && v.length > 0 ? v : null));

const int = (min = 0, max = 2_000_000) =>
  z
    .string()
    .trim()
    .nullish()
    .transform((v) => (v && v.length > 0 ? v : null))
    .refine((v) => v === null || /^\d+$/.test(v), "Nombre entier attendu")
    .transform((v) => (v === null ? null : Number(v)))
    .refine(
      (v) => v === null || (v >= min && v <= max),
      `Valeur attendue entre ${min} et ${max}`,
    );

const requiredInt = (min: number, max: number, label: string) =>
  z
    .string()
    .trim()
    .min(1, `${label} est requis`)
    .refine((v) => /^\d+$/.test(v), "Nombre entier attendu")
    .transform(Number)
    .refine((v) => v >= min && v <= max, `${label} hors limites`);

const date = z
  .string()
  .trim()
  .nullish()
  .transform((v) => (v && v.length > 0 ? v : null));

export const vehicleSchema = z.object({
  name: z.string().trim().min(2, "Nom trop court").max(160, "Nom trop long"),
  make: text(80),
  brandId: int(1, 1_000_000),
  model: text(80),
  licensePlate: z
    .string()
    .trim()
    .min(2, "Immatriculation requise")
    .max(30, "Immatriculation trop longue"),
  categoryId: int(1, 1_000_000),
  colorSlug: text(30),
  year: int(1950, 2100),
  mileage: int(0, 5_000_000),
  seats: int(1, 60),
  fuelType: z
    .string()
    .trim()
    .nullish()
    .transform((v) => (v && v.length > 0 ? v : null))
    .refine(
      (v) => v === null || (FUEL_TYPES as readonly string[]).includes(v),
      "Carburant inconnu",
    ),
  transmissionType: z
    .string()
    .trim()
    .nullish()
    .transform((v) => (v && v.length > 0 ? v : null))
    .refine(
      (v) => v === null || (TRANSMISSIONS as readonly string[]).includes(v),
      "Transmission inconnue",
    ),
  nextTechnicalControlDate: date,
  mainLocationId: int(1, 1_000_000),
  dailyRate: requiredInt(0, 10_000_000, "Le prix par jour"),
  weeklyRate: int(0, 50_000_000),
  monthlyRate: int(0, 200_000_000),
  baseKilometers: int(0, 1_000_000),
  extraKmPrice: int(0, 1_000_000),
  isUnlimitedKilometers: z
    .string()
    .nullish()
    .transform((v) => v === "on" || v === "true"),
});

export type VehicleInput = z.infer<typeof vehicleSchema>;

export function fieldErrors(error: z.ZodError): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const key = issue.path[0];
    if (typeof key === "string") (out[key] ??= []).push(issue.message);
  }
  return out;
}

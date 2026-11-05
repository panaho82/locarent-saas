import { z } from "zod";

/**
 * Référentiels du parc : emplacements (lieux de prise en charge) et services
 * supplémentaires. Libellés repris de recon/text/locations.txt et
 * extra-services.txt.
 */

const text = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullish()
    .transform((v) => (v && v.length > 0 ? v : null));

const int = (min = 0, max = 50_000_000) =>
  z
    .string()
    .trim()
    .nullish()
    .transform((v) => (v && v.length > 0 ? v : null))
    .refine((v) => v === null || /^\d+$/.test(v), "Nombre entier attendu")
    .transform((v) => (v === null ? null : Number(v)))
    .refine((v) => v === null || (v >= min && v <= max), `Valeur attendue entre ${min} et ${max}`);

const flag = z
  .string()
  .nullish()
  .transform((v) => v === "on" || v === "true");

export const locationSchema = z.object({
  name: z.string().trim().min(2, "Nom trop court").max(160, "Nom trop long"),
  address: text(255),
  island: text(80),
  openingHours: text(255),
  price: int(0, 10_000_000),
  isFree: flag,
  isPublic: flag,
  isDefault: flag,
});

export const extraServiceSchema = z.object({
  name: z.string().trim().min(2, "Nom trop court").max(120, "Nom trop long"),
  description: text(255),
  price: z
    .string()
    .trim()
    .min(1, "Le prix est requis")
    .refine((v) => /^\d+$/.test(v), "Nombre entier attendu")
    .transform(Number)
    .refine((v) => v >= 0 && v <= 10_000_000, "Prix hors limites"),
  priceType: z.enum(["per_day", "per_rental"]),
  maxQty: int(1, 999),
  isActive: flag,
});

export type LocationInput = z.infer<typeof locationSchema>;
export type ExtraServiceInput = z.infer<typeof extraServiceSchema>;

export function fieldErrors(error: z.ZodError): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const key = issue.path[0];
    if (typeof key === "string") (out[key] ??= []).push(issue.message);
  }
  return out;
}

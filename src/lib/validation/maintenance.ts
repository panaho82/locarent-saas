import { z } from "zod";

/** Interventions de maintenance du parc. */

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

const date = z
  .string()
  .trim()
  .nullish()
  .transform((v) => (v && v.length > 0 ? v : null));

const requiredInt = (min: number, max: number, label: string) =>
  z
    .string()
    .trim()
    .min(1, `${label} est requis`)
    .refine((v) => /^\d+$/.test(v), "Nombre entier attendu")
    .transform(Number)
    .refine((v) => v >= min && v <= max, `${label} hors limites`);

const MAINTENANCE_TYPES = ["service", "repair", "tires", "technical_control", "bodywork", "other"] as const;
const MAINTENANCE_STATUSES = ["planned", "in_progress", "done", "cancelled"] as const;

export const maintenanceSchema = z.object({
  vehicleId: z
    .string()
    .trim()
    .min(1, "Véhicule requis")
    .transform(Number)
    .refine((v) => Number.isInteger(v) && v > 0, "Véhicule invalide"),
  type: z.enum(MAINTENANCE_TYPES),
  status: z.enum(MAINTENANCE_STATUSES),
  title: z.string().trim().min(2, "Titre trop court").max(160, "Titre trop long"),
  description: text(2000),
  cost: requiredInt(0, 50_000_000, "Le coût"),
  mileage: int(0, 5_000_000),
  performedAt: date,
  nextDueDate: date,
  nextDueMileage: int(0, 5_000_000),
  garage: text(160),
});

export type MaintenanceInput = z.infer<typeof maintenanceSchema>;

export function fieldErrors(error: z.ZodError): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const key = issue.path[0];
    if (typeof key === "string") (out[key] ??= []).push(issue.message);
  }
  return out;
}

export const MAINTENANCE_TYPE_LABELS: Record<(typeof MAINTENANCE_TYPES)[number], string> = {
  service: "Entretien",
  repair: "Réparation",
  tires: "Pneus",
  technical_control: "Contrôle technique",
  bodywork: "Carrosserie",
  other: "Autre",
};

export const MAINTENANCE_STATUS_LABELS: Record<(typeof MAINTENANCE_STATUSES)[number], string> = {
  planned: "Planifié",
  in_progress: "En cours",
  done: "Terminé",
  cancelled: "Annulé",
};

export const MAINTENANCE_STATUS_DOT: Record<(typeof MAINTENANCE_STATUSES)[number], string> = {
  planned: "bg-muted",
  in_progress: "bg-info",
  done: "bg-success",
  cancelled: "bg-danger",
};

export { MAINTENANCE_TYPES, MAINTENANCE_STATUSES };

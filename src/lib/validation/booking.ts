import { z } from "zod";

/** Formulaire de réservation au comptoir. */

const time = z
  .string()
  .trim()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Heure attendue au format HH:MM");

const date = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Date attendue au format AAAA-MM-JJ");

const id = (label: string) =>
  z
    .string()
    .trim()
    .min(1, `${label} requis`)
    .transform(Number)
    .refine((v) => Number.isInteger(v) && v > 0, `${label} invalide`);

export const bookingSchema = z.object({
  customerId: id("Client"),
  vehicleId: id("Véhicule"),
  pickupLocationId: z
    .string()
    .trim()
    .nullish()
    .transform((v) => (v && v.length > 0 ? Number(v) : null)),
  dropoffLocationId: z
    .string()
    .trim()
    .nullish()
    .transform((v) => (v && v.length > 0 ? Number(v) : null)),

  startDate: date,
  startTime: time,
  endDate: date,
  endTime: time,

  unit: z.enum(["days", "weeks", "months"]),
  value: z
    .string()
    .trim()
    .min(1, "Durée requise")
    .refine((v) => /^\d+$/.test(v), "Durée entière attendue")
    .transform(Number)
    .refine((v) => v > 0 && v <= 365, "Durée hors limites"),

  isUnlimitedKilometers: z
    .string()
    .nullish()
    .transform((v) => v === "on" || v === "true"),

  /** Montant de location fixé à la main (permission booking.negotiate_rate). */
  negotiatedTotal: z
    .string()
    .trim()
    .nullish()
    .transform((v) => (v && v.length > 0 ? Number(v) : null))
    .refine((v) => v === null || (Number.isFinite(v) && v >= 0), "Montant invalide"),

  discountLabel: z.string().trim().max(120).nullish(),
  discountType: z.enum(["amount", "percent"]).nullish(),
  discountValue: z
    .string()
    .trim()
    .nullish()
    .transform((v) => (v && v.length > 0 ? Number(v) : 0))
    .refine((v) => Number.isFinite(v) && v >= 0, "Remise invalide"),

  notes: z.string().trim().max(2000).nullish(),
  internalNotes: z.string().trim().max(2000).nullish(),
});

export type BookingInput = z.infer<typeof bookingSchema>;

export function fieldErrors(error: z.ZodError): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const key = issue.path[0];
    if (typeof key === "string") (out[key] ??= []).push(issue.message);
  }
  return out;
}

export const BOOKING_STATUS_LABELS: Record<string, string> = {
  pending: "En attente",
  confirmed: "Confirmée",
  in_progress: "En location",
  completed: "Terminée",
  cancelled: "Annulée",
  declined: "Refusée",
  expired: "Expirée",
};

export const BOOKING_STATUS_DOT: Record<string, string> = {
  pending: "bg-warning",
  confirmed: "bg-success",
  in_progress: "bg-info",
  completed: "bg-muted",
  cancelled: "bg-danger",
  declined: "bg-danger",
  expired: "bg-muted",
};

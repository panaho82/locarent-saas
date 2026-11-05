import { z } from "zod";

/** Clients (particuliers), sociétés et conducteurs. */

const text = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullish()
    .transform((v) => (v && v.length > 0 ? v : null));

const email = z
  .string()
  .trim()
  .max(190)
  .nullish()
  .transform((v) => (v && v.length > 0 ? v.toLowerCase() : null))
  .refine(
    (v) => v === null || /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v),
    "Adresse email invalide",
  );

const date = z
  .string()
  .trim()
  .nullish()
  .transform((v) => (v && v.length > 0 ? v : null));

export const customerSchema = z.object({
  type: z.enum(["private", "company"]).default("private"),
  isInsurance: z.string().nullish().transform((v) => v === "on" || v === "true"),
  firstName: z.string().trim().min(1, "Prénom requis").max(80, "Prénom trop long"),
  lastName: z.string().trim().min(1, "Nom requis").max(80, "Nom trop long"),
  email,
  phone: text(40),
  phoneCode: text(8),
  address: text(255),
  zipcode: text(20),
  city: text(120),
  country: text(80),
  notes: text(2000),
});

export const companySchema = z.object({
  name: z.string().trim().min(2, "Nom trop court").max(160, "Nom trop long"),
  contactName: text(160),
  email,
  phone: text(40),
  address: text(255),
  zipcode: text(20),
  city: text(120),
  country: text(80),
  taxId: text(60),
  notes: text(2000),
});

export const driverSchema = z.object({
  customerId: z.string().trim().min(1, "Client requis"),
  firstName: z.string().trim().min(1, "Prénom requis").max(80, "Prénom trop long"),
  lastName: z.string().trim().min(1, "Nom requis").max(80, "Nom trop long"),
  dateOfBirth: date,
  licenseCardNumber: text(60),
  licenseIssuedAt: date,
  licenseExpiresAt: date,
  licenseCountry: text(80),
  isMain: z.string().nullish().transform((v) => v === "on" || v === "true"),
});

export type CustomerInput = z.infer<typeof customerSchema>;
export type CompanyInput = z.infer<typeof companySchema>;
export type DriverInput = z.infer<typeof driverSchema>;

export function fieldErrors(error: z.ZodError): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const key = issue.path[0];
    if (typeof key === "string") (out[key] ??= []).push(issue.message);
  }
  return out;
}

/** « FRANCK TERIITAUMIHAU » — la liste d'origine affiche le nom en capitales. */
export function displayName(firstName: string | null, lastName: string | null): string {
  return [firstName, lastName].filter(Boolean).join(" ").toUpperCase();
}

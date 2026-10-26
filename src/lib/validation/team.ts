import { z } from "zod";
import { ASSIGNABLE_ROLES, PERMISSIONS } from "@/server/auth/permissions";

const permissionValues = PERMISSIONS as readonly string[];

export const inviteMemberSchema = z.object({
  email: z
    .string()
    .trim()
    .min(3, "Adresse email trop courte")
    .max(190, "Adresse email trop longue")
    .regex(/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/, "Adresse email invalide")
    .transform((value) => value.toLowerCase()),
  role: z.enum(ASSIGNABLE_ROLES),
  permissions: z
    .array(z.string())
    .default([])
    .transform((values) => values.filter((value) => permissionValues.includes(value))),
});

export const updateMemberSchema = z.object({
  userId: z.coerce.number().int().positive(),
  role: z.enum(ASSIGNABLE_ROLES),
  permissions: z
    .array(z.string())
    .default([])
    .transform((values) => values.filter((value) => permissionValues.includes(value))),
});

export const companySettingsSchema = z.object({
  name: z.string().trim().min(2, "Nom trop court").max(160, "Nom trop long"),
  managerName: z.string().trim().max(160).optional().or(z.literal("")),
  email: z
    .string()
    .trim()
    .min(3)
    .max(190)
    .regex(/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/, "Adresse email invalide"),
  phone: z.string().trim().max(40).optional().or(z.literal("")),
  tahitiNumber: z.string().trim().max(40).optional().or(z.literal("")),
  address: z.string().trim().max(255).optional().or(z.literal("")),
  city: z.string().trim().max(120).optional().or(z.literal("")),
  zipcode: z.string().trim().max(20).optional().or(z.literal("")),
  island: z.string().trim().max(80).optional().or(z.literal("")),
  companyTagline: z.string().trim().max(160).optional().or(z.literal("")),
  primaryColor: z
    .string()
    .trim()
    .regex(/^#[0-9a-fA-F]{6}$/, "Couleur attendue au format #RRGGBB"),
});

export type InviteMemberInput = z.infer<typeof inviteMemberSchema>;
export type UpdateMemberInput = z.infer<typeof updateMemberSchema>;
export type CompanySettingsInput = z.infer<typeof companySettingsSchema>;

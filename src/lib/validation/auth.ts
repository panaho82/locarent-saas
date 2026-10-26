import { z } from "zod";
import { PASSWORD_MIN_LENGTH } from "@/server/auth/password";

/**
 * Schémas de validation partagés entre le formulaire (côté client, messages
 * immédiats) et la Server Action (côté serveur, source de vérité).
 *
 * Les regex sont écrites explicitement plutôt que via les helpers zod 4 :
 * moins de dépendance à l'évolution de l'API entre versions mineures.
 */

const email = z
  .string()
  .trim()
  .min(3, "Adresse email trop courte")
  .max(190, "Adresse email trop longue")
  .regex(
    /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/,
    "Adresse email invalide",
  )
  .transform((value) => value.toLowerCase());

const password = z
  .string()
  .min(
    PASSWORD_MIN_LENGTH,
    `Le mot de passe doit contenir au moins ${PASSWORD_MIN_LENGTH} caractères`,
  )
  .max(200, "Mot de passe trop long");

const personName = z
  .string()
  .trim()
  .min(2, "Nom trop court")
  .max(160, "Nom trop long");

export const loginSchema = z.object({
  email,
  password: z.string().min(1, "Mot de passe requis"),
});

export const registerSchema = z
  .object({
    tenantName: z
      .string()
      .trim()
      .min(2, "Nom de l'agence trop court")
      .max(160, "Nom de l'agence trop long"),
    name: personName,
    email,
    password,
    passwordConfirmation: z.string(),
  })
  .refine((data) => data.password === data.passwordConfirmation, {
    message: "Les deux mots de passe ne correspondent pas",
    path: ["passwordConfirmation"],
  });

export const forgotPasswordSchema = z.object({ email });

export const resetPasswordSchema = z
  .object({
    token: z.string().min(10, "Lien invalide"),
    password,
    passwordConfirmation: z.string(),
  })
  .refine((data) => data.password === data.passwordConfirmation, {
    message: "Les deux mots de passe ne correspondent pas",
    path: ["passwordConfirmation"],
  });

export const acceptInviteSchema = z
  .object({
    token: z.string().min(10, "Lien d'invitation invalide"),
    name: personName,
    password,
    passwordConfirmation: z.string(),
  })
  .refine((data) => data.password === data.passwordConfirmation, {
    message: "Les deux mots de passe ne correspondent pas",
    path: ["passwordConfirmation"],
  });

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export type AcceptInviteInput = z.infer<typeof acceptInviteSchema>;

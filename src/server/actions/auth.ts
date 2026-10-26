"use server";

import { randomBytes } from "node:crypto";
import { redirect } from "next/navigation";
import { z } from "zod";
import {
  acceptInviteSchema,
  forgotPasswordSchema,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
} from "@/lib/validation/auth";
import { slugify } from "@/lib/slug";
import { prisma } from "@/server/db";
import { hashPassword, verifyPassword } from "@/server/auth/password";
import { hashToken } from "@/server/auth/session";
import {
  endSession,
  startSession,
} from "@/server/auth/session-context";
import { appUrl, sendMail } from "@/server/mail";
import type { AuthActionState } from "./types";

/**
 * Server Actions d'authentification.
 *
 * Règles tenues ici :
 *  · toute la validation est refaite côté serveur (les messages du client ne
 *    sont qu'un confort) ;
 *  · aucune énumération de comptes : « email inconnu » et « mot de passe
 *    incorrect » produisent le même message ;
 *  · les tokens envoyés par email ne sont jamais stockés en clair.
 */

const RESET_TOKEN_TTL_MS = 60 * 60 * 1000; // 1 heure

function fieldErrorsOf(error: z.ZodError): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const key = issue.path[0];
    if (typeof key === "string") {
      (out[key] ??= []).push(issue.message);
    }
  }
  return out;
}

async function uniqueTenantSlug(name: string): Promise<string> {
  const base = slugify(name).slice(0, 60) || "agence";
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const candidate =
      attempt === 0
        ? base
        : `${base}-${randomBytes(3).toString("hex")}`;
    const exists = await prisma.tenant.findUnique({
      where: { slug: candidate },
      select: { id: true },
    });
    if (!exists) return candidate;
  }
  return `${base}-${randomBytes(6).toString("hex")}`;
}

// -----------------------------------------------------------------------------
//  Inscription : agence + propriétaire + réglages + essai, en une transaction
// -----------------------------------------------------------------------------

export async function registerAction(
  _previous: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const parsed = registerSchema.safeParse({
    tenantName: formData.get("tenantName"),
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
    passwordConfirmation: formData.get("passwordConfirmation"),
  });

  if (!parsed.success) {
    return { status: "error", fieldErrors: fieldErrorsOf(parsed.error) };
  }

  const data = parsed.data;

  const existing = await prisma.user.findFirst({
    where: { email: data.email },
    select: { id: true },
  });
  if (existing) {
    return {
      status: "error",
      fieldErrors: {
        email: ["Un compte utilise déjà cette adresse email."],
      },
    };
  }

  const passwordHash = await hashPassword(data.password);

  let created: { userId: number; tenantId: number };
  try {
    created = await prisma.$transaction(async (tx) => {
      const tenant = await tx.tenant.create({
        data: {
          slug: await uniqueTenantSlug(data.tenantName),
          name: data.tenantName,
          managerName: data.name,
          email: data.email,
          country: "PF",
          timezone: "Pacific/Tahiti",
        },
        select: { id: true },
      });

      await tx.settings.create({ data: { tenantId: tenant.id } });

      const user = await tx.user.create({
        data: {
          tenantId: tenant.id,
          name: data.name,
          email: data.email,
          password: passwordHash,
          role: "owner",
          isFounder: true,
          permissions: [],
        },
        select: { id: true },
      });

      // Essai gratuit d'un mois sur le plan le plus complet (comme le compte
      // analysé), pour que l'agence découvre toutes les fonctions.
      const plan = await tx.plan.findUnique({ where: { slug: "pro" } });
      if (plan) {
        const start = new Date();
        const end = new Date(start);
        end.setMonth(end.getMonth() + 1);
        await tx.subscription.create({
          data: {
            tenantId: tenant.id,
            planId: plan.id,
            status: "trial",
            billingPeriod: "monthly",
            currentPrice: plan.monthlyPrice,
            trialStartDate: start,
            trialEndDate: end,
            currentPeriodStart: start,
            currentPeriodEnd: end,
            nextRenewalDate: end,
          },
        });
      }

      return { userId: user.id, tenantId: tenant.id };
    });
  } catch (error) {
    // Contrainte d'unicité (email global ou slug) violée entre-temps.
    if ((error as { code?: string }).code === "P2002") {
      return {
        status: "error",
        message:
          "Ce compte vient d'être créé par une autre requête. Réessayez ou connectez-vous.",
      };
    }
    console.error("registerAction", error);
    return {
      status: "error",
      message: "Impossible de créer le compte pour le moment.",
    };
  }

  await startSession({ userId: created.userId, tenantId: created.tenantId });
  redirect("/admin/index");
}

// -----------------------------------------------------------------------------
//  Connexion / déconnexion
// -----------------------------------------------------------------------------

/** Hash factice : égalise le temps de réponse quand l'email est inconnu. */
let dummyHash: string | null = null;
async function getDummyHash(): Promise<string> {
  dummyHash ??= await hashPassword("mot-de-passe-factice-pour-le-temps");
  return dummyHash;
}

export async function loginAction(
  _previous: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { status: "error", fieldErrors: fieldErrorsOf(parsed.error) };
  }

  const { email, password } = parsed.data;

  const user = await prisma.user.findFirst({
    where: { email },
    select: {
      id: true,
      tenantId: true,
      password: true,
      isDeactivated: true,
    },
  });

  if (!user) {
    // On vérifie quand même un hash : le temps de réponse ne doit pas révéler
    // l'existence du compte.
    await verifyPassword(await getDummyHash(), password);
    return {
      status: "error",
      message: "Adresse email ou mot de passe incorrect.",
    };
  }

  const valid = await verifyPassword(user.password, password);
  if (!valid) {
    return {
      status: "error",
      message: "Adresse email ou mot de passe incorrect.",
    };
  }

  if (user.isDeactivated) {
    return {
      status: "error",
      message:
        "Ce compte est désactivé. Contactez le propriétaire de l'agence.",
    };
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
  });

  await startSession({ userId: user.id, tenantId: user.tenantId });
  redirect("/admin/index");
}

export async function logoutAction(): Promise<void> {
  await endSession();
  redirect("/login");
}

// -----------------------------------------------------------------------------
//  Mot de passe oublié / réinitialisation
// -----------------------------------------------------------------------------

export async function forgotPasswordAction(
  _previous: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const parsed = forgotPasswordSchema.safeParse({
    email: formData.get("email"),
  });

  if (!parsed.success) {
    return { status: "error", fieldErrors: fieldErrorsOf(parsed.error) };
  }

  const user = await prisma.user.findFirst({
    where: { email: parsed.data.email },
    select: { id: true, email: true, name: true, isDeactivated: true },
  });

  // Réponse identique dans tous les cas : pas d'énumération de comptes.
  const generic: AuthActionState = {
    status: "success",
    message:
      "Si un compte existe avec cette adresse, un lien de réinitialisation vient d'être envoyé.",
  };

  if (!user || user.isDeactivated) return generic;

  const token = randomBytes(32).toString("base64url");

  // Un seul token valide à la fois par utilisateur.
  await prisma.passwordResetToken.deleteMany({
    where: { userId: user.id, usedAt: null },
  });
  await prisma.passwordResetToken.create({
    data: {
      userId: user.id,
      tokenHash: hashToken(token),
      expiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MS),
    },
  });

  await sendMail({
    to: user.email,
    subject: "Réinitialisation de votre mot de passe",
    text: [
      `Bonjour ${user.name},`,
      "",
      "Vous avez demandé à réinitialiser votre mot de passe.",
      "Ce lien est valable une heure et ne sert qu'une fois :",
      "",
      appUrl(`/reset-password?token=${encodeURIComponent(token)}`),
      "",
      "Si vous n'êtes pas à l'origine de cette demande, ignorez cet email.",
    ].join("\n"),
  });

  return generic;
}

export async function resetPasswordAction(
  _previous: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const parsed = resetPasswordSchema.safeParse({
    token: formData.get("token"),
    password: formData.get("password"),
    passwordConfirmation: formData.get("passwordConfirmation"),
  });

  if (!parsed.success) {
    return { status: "error", fieldErrors: fieldErrorsOf(parsed.error) };
  }

  const record = await prisma.passwordResetToken.findUnique({
    where: { tokenHash: hashToken(parsed.data.token) },
    select: { id: true, userId: true, expiresAt: true, usedAt: true },
  });

  if (!record || record.usedAt || record.expiresAt.getTime() <= Date.now()) {
    return {
      status: "error",
      message:
        "Ce lien de réinitialisation est invalide ou a expiré. Refaites une demande.",
    };
  }

  const passwordHash = await hashPassword(parsed.data.password);

  await prisma.$transaction([
    prisma.user.update({
      where: { id: record.userId },
      data: { password: passwordHash },
    }),
    prisma.passwordResetToken.update({
      where: { id: record.id },
      data: { usedAt: new Date() },
    }),
    prisma.session.updateMany({
      where: { userId: record.userId, revokedAt: null },
      data: { revokedAt: new Date() },
    }),
  ]);

  redirect("/login?reset=1");
}

// -----------------------------------------------------------------------------
//  Invitations
// -----------------------------------------------------------------------------

export type InvitationPreview = {
  ok: boolean;
  reason?: "introuvable" | "expiree" | "deja-acceptee";
  email?: string;
  tenantName?: string;
  role?: string;
};

/** Lecture d'une invitation pour l'écran d'acceptation (pas de données sensibles). */
export async function getInvitationPreview(
  token: string,
): Promise<InvitationPreview> {
  if (!token) return { ok: false, reason: "introuvable" };

  const invitation = await prisma.invitation.findUnique({
    where: { token: hashToken(token) },
    select: {
      email: true,
      role: true,
      expiresAt: true,
      acceptedAt: true,
      tenant: { select: { name: true } },
    },
  });

  if (!invitation) return { ok: false, reason: "introuvable" };
  if (invitation.acceptedAt) return { ok: false, reason: "deja-acceptee" };
  if (invitation.expiresAt.getTime() <= Date.now()) {
    return { ok: false, reason: "expiree" };
  }

  return {
    ok: true,
    email: invitation.email,
    tenantName: invitation.tenant.name,
    role: invitation.role,
  };
}

export async function acceptInviteAction(
  _previous: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const parsed = acceptInviteSchema.safeParse({
    token: formData.get("token"),
    name: formData.get("name"),
    password: formData.get("password"),
    passwordConfirmation: formData.get("passwordConfirmation"),
  });

  if (!parsed.success) {
    return { status: "error", fieldErrors: fieldErrorsOf(parsed.error) };
  }

  const invitation = await prisma.invitation.findUnique({
    where: { token: hashToken(parsed.data.token) },
    select: {
      id: true,
      tenantId: true,
      email: true,
      role: true,
      permissions: true,
      expiresAt: true,
      acceptedAt: true,
    },
  });

  if (!invitation || invitation.acceptedAt) {
    return { status: "error", message: "Cette invitation n'est plus valable." };
  }
  if (invitation.expiresAt.getTime() <= Date.now()) {
    return {
      status: "error",
      message: "Cette invitation a expiré. Demandez-en une nouvelle.",
    };
  }

  const existing = await prisma.user.findFirst({
    where: { email: invitation.email },
    select: { id: true },
  });
  if (existing) {
    return {
      status: "error",
      message:
        "Un compte existe déjà avec cette adresse. Connectez-vous plutôt.",
    };
  }

  const passwordHash = await hashPassword(parsed.data.password);
  const permissions = Array.isArray(invitation.permissions)
    ? invitation.permissions
    : [];

  const user = await prisma.$transaction(async (tx) => {
    const created = await tx.user.create({
      data: {
        tenantId: invitation.tenantId,
        name: parsed.data.name,
        email: invitation.email,
        password: passwordHash,
        role: invitation.role,
        permissions: permissions as object,
      },
      select: { id: true },
    });

    await tx.invitation.update({
      where: { id: invitation.id },
      data: { acceptedAt: new Date() },
    });

    return created;
  });

  await startSession({ userId: user.id, tenantId: invitation.tenantId });
  redirect("/admin/index");
}


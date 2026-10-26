"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { can } from "@/server/auth/permissions";
import { hashToken } from "@/server/auth/session";
import { requireSession } from "@/server/auth/session-context";
import { logActivity } from "@/server/audit";
import { prisma } from "@/server/db";
import { appUrl, isConsoleTransport, sendMail } from "@/server/mail";
import { inviteMemberSchema } from "@/lib/validation/team";
import { updateMemberSchema } from "@/lib/validation/team";
import { PERMISSIONS } from "@/server/auth/permissions";
import type { ActionState } from "./types";

/**
 * Gestion de l'équipe : invitation, rôle, permissions, désactivation.
 *
 * Tout est vérifié côté serveur. L'interface masque les boutons, mais une
 * Server Action est un endpoint HTTP public : elle ne suppose rien du client.
 */

const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 jours

function fieldErrorsOf(error: {
  issues: { path: PropertyKey[]; message: string }[];
}): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const key = issue.path[0];
    if (typeof key === "string") (out[key] ??= []).push(issue.message);
  }
  return out;
}

/** Permissions que l'acteur peut attribuer (on ne donne pas ce qu'on n'a pas). */
function grantablePermissions(
  viewer: { role: string; permissions: readonly string[] },
): Set<string> {
  return viewer.role === "owner"
    ? new Set(PERMISSIONS)
    : new Set(viewer.permissions);
}

export async function inviteMemberAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await requireSession();

  if (!can(session, "user.invite")) {
    return {
      status: "error",
      message: "Votre rôle ne permet pas d'inviter un membre.",
    };
  }

  const parsed = inviteMemberSchema.safeParse({
    email: formData.get("email"),
    role: formData.get("role"),
    permissions: formData.getAll("permissions").map(String),
  });

  if (!parsed.success) {
    return { status: "error", fieldErrors: fieldErrorsOf(parsed.error) };
  }

  const { email, role } = parsed.data;

  if (role === "admin" && session.role !== "owner") {
    return {
      status: "error",
      message: "Seul le propriétaire peut nommer un administrateur.",
    };
  }

  const grantable = grantablePermissions(session);
  const permissions = parsed.data.permissions.filter((p) => grantable.has(p));

  const existingUser = await prisma.user.findFirst({
    where: { email },
    select: { id: true },
  });
  if (existingUser) {
    return {
      status: "error",
      fieldErrors: { email: ["Un compte utilise déjà cette adresse."] },
    };
  }

  const pending = await prisma.invitation.findFirst({
    where: {
      tenantId: session.tenantId,
      email,
      acceptedAt: null,
      expiresAt: { gt: new Date() },
    },
    select: { id: true },
  });
  if (pending) {
    return {
      status: "error",
      fieldErrors: {
        email: ["Une invitation est déjà en attente pour cette adresse."],
      },
    };
  }

  const token = randomBytes(32).toString("base64url");

  const invitation = await prisma.invitation.create({
    data: {
      tenantId: session.tenantId,
      email,
      role,
      permissions,
      token: hashToken(token),
      invitedBy: session.userId,
      expiresAt: new Date(Date.now() + INVITE_TTL_MS),
    },
    select: { id: true },
  });

  const link = appUrl(`/accept-invite?token=${encodeURIComponent(token)}`);

  await sendMail({
    to: email,
    subject: `Invitation à rejoindre ${session.tenant.name}`,
    text: [
      `Bonjour,`,
      "",
      `${session.name} vous invite à rejoindre l'espace « ${session.tenant.name} » sur Locarent.`,
      "",
      "Créez votre compte avec ce lien (valable 7 jours) :",
      link,
      "",
      "Si vous n'attendiez pas cette invitation, ignorez cet email.",
    ].join("\n"),
  });

  await logActivity({
    tenantId: session.tenantId,
    userId: session.userId,
    action: "user.invited",
    subjectType: "invitation",
    subjectId: invitation.id,
    properties: { email, role, permissions },
  });

  revalidatePath("/admin/settings/team");

  // Tant qu'aucun email ne part réellement (transport « console »), le lien est
  // affiché à la personne qui invite — seule à pouvoir le générer. Dès qu'un
  // transport SMTP est branché, le lien n'apparaît plus dans l'interface.
  return {
    status: "success",
    message: isConsoleTransport()
      ? `Invitation créée pour ${email}. Lien à transmettre : ${link}`
      : `Invitation envoyée à ${email}.`,
  };
}

export async function updateMemberAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await requireSession();

  if (!can(session, "user.edit")) {
    return { status: "error", message: "Action non autorisée." };
  }

  const parsed = updateMemberSchema.safeParse({
    userId: formData.get("userId"),
    role: formData.get("role"),
    permissions: formData.getAll("permissions").map(String),
  });

  if (!parsed.success) {
    return { status: "error", fieldErrors: fieldErrorsOf(parsed.error) };
  }

  const target = await prisma.user.findFirst({
    where: { id: parsed.data.userId, tenantId: session.tenantId },
    select: { id: true, role: true, email: true },
  });

  if (!target) {
    return { status: "error", message: "Membre introuvable." };
  }
  if (target.role === "owner") {
    return {
      status: "error",
      message: "Le propriétaire de l'agence ne peut pas être modifié.",
    };
  }
  if (parsed.data.role === "admin" && session.role !== "owner") {
    return {
      status: "error",
      message: "Seul le propriétaire peut nommer un administrateur.",
    };
  }

  const grantable = grantablePermissions(session);
  const permissions = parsed.data.permissions.filter((p) => grantable.has(p));

  await prisma.user.update({
    where: { id: target.id },
    data: { role: parsed.data.role, permissions },
  });

  await logActivity({
    tenantId: session.tenantId,
    userId: session.userId,
    action: "user.updated",
    subjectType: "user",
    subjectId: target.id,
    properties: { email: target.email, role: parsed.data.role, permissions },
  });

  revalidatePath("/admin/settings/team");
  return { status: "success", message: "Membre mis à jour." };
}

export async function deactivateMemberAction(
  formData: FormData,
): Promise<void> {
  const session = await requireSession();
  const userId = Number(formData.get("userId"));

  if (!can(session, "user.remove")) return;
  if (!Number.isInteger(userId) || userId === session.userId) return;

  const target = await prisma.user.findFirst({
    where: { id: userId, tenantId: session.tenantId },
    select: { id: true, role: true, email: true },
  });
  if (!target || target.role === "owner") return;

  await prisma.$transaction([
    prisma.user.update({
      where: { id: target.id },
      data: { isDeactivated: true, deactivatedAt: new Date() },
    }),
    // Une désactivation doit couper l'accès immédiatement, pas dans 30 jours.
    prisma.session.updateMany({
      where: { userId: target.id, revokedAt: null },
      data: { revokedAt: new Date() },
    }),
  ]);

  await logActivity({
    tenantId: session.tenantId,
    userId: session.userId,
    action: "user.deactivated",
    subjectType: "user",
    subjectId: target.id,
    properties: { email: target.email },
  });

  revalidatePath("/admin/settings/team");
}

export async function reactivateMemberAction(
  formData: FormData,
): Promise<void> {
  const session = await requireSession();
  const userId = Number(formData.get("userId"));

  if (!can(session, "user.edit")) return;
  if (!Number.isInteger(userId)) return;

  const target = await prisma.user.findFirst({
    where: { id: userId, tenantId: session.tenantId },
    select: { id: true, email: true },
  });
  if (!target) return;

  await prisma.user.update({
    where: { id: target.id },
    data: { isDeactivated: false, deactivatedAt: null },
  });

  await logActivity({
    tenantId: session.tenantId,
    userId: session.userId,
    action: "user.reactivated",
    subjectType: "user",
    subjectId: target.id,
    properties: { email: target.email },
  });

  revalidatePath("/admin/settings/team");
}

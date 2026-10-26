import { createHash, randomBytes } from "node:crypto";
import type { Role } from "../../generated/prisma/client";
import { prisma } from "../db";
import { SESSION_COOKIE, SESSION_TTL_MS } from "./constants";

/**
 * Sessions.
 *
 * Principe : le client reçoit un token opaque de 32 octets ; la base ne stocke
 * que son SHA-256. Une fuite de la table `sessions` ne permet donc pas de
 * rejouer une session.
 *
 * Ce module utilise le client **brut** (`prisma`), et c'est volontaire : il
 * s'exécute au moment où l'on découvre l'agence, donc avant qu'un contexte
 * tenant ne puisse exister.
 */

export { SESSION_COOKIE, SESSION_TTL_MS };

/** On ne réécrit `lastUsedAt` qu'une fois par heure : évite un UPDATE par requête. */
const TOUCH_INTERVAL_MS = 60 * 60 * 1000;

export type SessionUser = {
  sessionId: number;
  userId: number;
  tenantId: number;
  name: string;
  email: string;
  role: Role;
  permissions: string[];
  tenant: {
    id: number;
    name: string;
    slug: string;
    timezone: string;
    primaryColor: string;
    tvaEnabled: boolean;
    defaultTaxRate: number;
  };
};

export function generateToken(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function createSession(input: {
  userId: number;
  tenantId: number;
  ip?: string | null;
  userAgent?: string | null;
}): Promise<{ token: string; sessionId: number; expiresAt: Date }> {
  const token = generateToken();
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);

  const session = await prisma.session.create({
    data: {
      tenantId: input.tenantId,
      userId: input.userId,
      tokenHash: hashToken(token),
      ip: input.ip?.slice(0, 45) ?? null,
      userAgent: input.userAgent?.slice(0, 512) ?? null,
      expiresAt,
    },
    select: { id: true },
  });

  return { token, sessionId: session.id, expiresAt };
}

function toStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

/**
 * Résout un token de session. Renvoie `null` si le token est inconnu, révoqué,
 * expiré, ou si le compte a été désactivé entre-temps.
 */
export async function resolveSession(
  token: string,
): Promise<SessionUser | null> {
  if (!token) return null;

  const session = await prisma.session.findUnique({
    where: { tokenHash: hashToken(token) },
    include: {
      user: {
        include: {
          tenant: { include: { settings: true } },
        },
      },
    },
  });

  if (!session) return null;
  if (session.revokedAt) return null;
  if (session.expiresAt.getTime() <= Date.now()) return null;
  if (session.user.isDeactivated) return null;

  // Mise à jour paresseuse : au plus une écriture par heure et par session.
  const lastUsedMs = session.lastUsedAt.getTime();
  if (Date.now() - lastUsedMs > TOUCH_INTERVAL_MS) {
    void prisma.session
      .update({
        where: { id: session.id },
        data: { lastUsedAt: new Date() },
      })
      .catch(() => {
        /* le rafraîchissement n'est pas critique */
      });
  }

  const { user } = session;
  const settings = user.tenant.settings;

  return {
    sessionId: session.id,
    userId: user.id,
    tenantId: user.tenantId,
    name: user.name,
    email: user.email,
    role: user.role,
    permissions: toStringArray(user.permissions),
    tenant: {
      id: user.tenant.id,
      name: user.tenant.name,
      slug: user.tenant.slug,
      timezone: user.tenant.timezone,
      primaryColor: settings?.primaryColor ?? "#2563eb",
      tvaEnabled: settings?.tvaEnabled ?? false,
      defaultTaxRate: Number(settings?.defaultTaxRate ?? 0),
    },
  };
}

export async function revokeSessionByToken(token: string): Promise<void> {
  if (!token) return;
  await prisma.session.updateMany({
    where: { tokenHash: hashToken(token), revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

/** Révoque toutes les sessions d'un utilisateur (désactivation, changement de mot de passe). */
export async function revokeAllSessions(
  userId: number,
  exceptSessionId?: number,
): Promise<number> {
  const result = await prisma.session.updateMany({
    where: {
      userId,
      revokedAt: null,
      ...(exceptSessionId ? { id: { not: exceptSessionId } } : {}),
    },
    data: { revokedAt: new Date() },
  });
  return result.count;
}

/** Purge les sessions expirées depuis plus de 30 jours (tâche d'entretien). */
export async function purgeExpiredSessions(): Promise<number> {
  const cutoff = new Date(Date.now() - SESSION_TTL_MS);
  const result = await prisma.session.deleteMany({
    where: { expiresAt: { lt: cutoff } },
  });
  return result.count;
}

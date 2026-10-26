import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import {
  createSession,
  resolveSession,
  revokeSessionByToken,
  SESSION_COOKIE,
  SESSION_TTL_MS,
  type SessionUser,
} from "./session";

/**
 * Accès à la session courante côté serveur.
 *
 * `getCurrentSession` est mémoïsé par requête : plusieurs appels dans un même
 * rendu ne produisent qu'une lecture en base.
 */

export const getCurrentSession = cache(
  async (): Promise<SessionUser | null> => {
    const store = await cookies();
    const token = store.get(SESSION_COOKIE)?.value;
    if (!token) return null;
    return resolveSession(token);
  },
);

/** Session obligatoire : redirige vers /login si absente. */
export async function requireSession(): Promise<SessionUser> {
  const session = await getCurrentSession();
  if (!session) {
    redirect("/login");
  }
  return session;
}

/** Session interdite (écrans d'authentification) : renvoie l'utilisateur vers son espace. */
export async function redirectIfAuthenticated(): Promise<void> {
  const session = await getCurrentSession();
  if (session) {
    redirect("/admin/index");
  }
}

function cookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: Math.floor(SESSION_TTL_MS / 1000),
  };
}

/** Ouvre une session et pose le cookie. */
export async function startSession(input: {
  userId: number;
  tenantId: number;
}): Promise<{ sessionId: number }> {
  const requestHeaders = await headers();
  const forwarded = requestHeaders.get("x-forwarded-for");
  const ip = forwarded?.split(",")[0]?.trim() ?? null;
  const userAgent = requestHeaders.get("user-agent");

  const { token, sessionId } = await createSession({
    userId: input.userId,
    tenantId: input.tenantId,
    ip,
    userAgent,
  });

  const store = await cookies();
  store.set(SESSION_COOKIE, token, cookieOptions());

  return { sessionId };
}

/** Ferme la session courante et efface le cookie. */
export async function endSession(): Promise<void> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (token) {
    await revokeSessionByToken(token);
  }
  store.delete(SESSION_COOKIE);
}

export { SESSION_COOKIE };

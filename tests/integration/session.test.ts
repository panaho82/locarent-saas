import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "@/server/auth/password";
import {
  createSession,
  hashToken,
  resolveSession,
  revokeAllSessions,
  revokeSessionByToken,
} from "@/server/auth/session";
import { prisma } from "@/server/db";

/**
 * Sessions et mots de passe — testés sur la vraie base.
 *
 * Ce qui compte ici : un token révoqué, expiré ou appartenant à un compte
 * désactivé ne doit plus rien ouvrir.
 */

const suffix = randomUUID().slice(0, 8);
let tenantId: number;
let userId: number;

beforeAll(async () => {
  const tenant = await prisma.tenant.create({
    data: {
      slug: `test-session-${suffix}`,
      name: "Test Session",
      email: `session-${suffix}@locarent.test`,
      country: "PF",
    },
  });
  tenantId = tenant.id;

  const user = await prisma.user.create({
    data: {
      tenantId,
      name: "Test Session",
      email: `user-${suffix}@locarent.test`,
      password: await hashPassword("mot-de-passe-de-test"),
      role: "owner",
    },
  });
  userId = user.id;
});

afterAll(async () => {
  await prisma.tenant.deleteMany({ where: { id: tenantId } });
  await prisma.$disconnect();
});

describe("mots de passe", () => {
  it("produit un hash Argon2id vérifiable, jamais le mot de passe en clair", async () => {
    const hash = await hashPassword("un-mot-de-passe-solide");
    expect(hash).toMatch(/^\$argon2id\$/);
    expect(hash).not.toContain("un-mot-de-passe-solide");
    await expect(verifyPassword(hash, "un-mot-de-passe-solide")).resolves.toBe(
      true,
    );
    await expect(verifyPassword(hash, "mauvais")).resolves.toBe(false);
  });

  it("renvoie false plutôt que de lever sur un hash corrompu", async () => {
    await expect(verifyPassword("pas-un-hash", "x")).resolves.toBe(false);
  });
});

describe("sessions", () => {
  it("résout une session valide vers son utilisateur et son agence", async () => {
    const { token } = await createSession({ userId, tenantId });
    const session = await resolveSession(token);

    expect(session).not.toBeNull();
    expect(session?.userId).toBe(userId);
    expect(session?.tenantId).toBe(tenantId);
    expect(session?.tenant.name).toBe("Test Session");
  });

  it("ne stocke jamais le token en clair", async () => {
    const { token } = await createSession({ userId, tenantId });
    const stored = await prisma.session.findUnique({
      where: { tokenHash: hashToken(token) },
    });
    expect(stored).not.toBeNull();
    const all = await prisma.session.findMany({ where: { userId } });
    expect(all.some((s) => s.tokenHash === token)).toBe(false);
  });

  it("refuse un token inconnu", async () => {
    await expect(resolveSession("token-invente")).resolves.toBeNull();
  });

  it("refuse une session révoquée", async () => {
    const { token } = await createSession({ userId, tenantId });
    await revokeSessionByToken(token);
    await expect(resolveSession(token)).resolves.toBeNull();
  });

  it("refuse une session expirée", async () => {
    const { token } = await createSession({ userId, tenantId });
    await prisma.session.update({
      where: { tokenHash: hashToken(token) },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });
    await expect(resolveSession(token)).resolves.toBeNull();
  });

  it("refuse une session dont le compte a été désactivé", async () => {
    const { token } = await createSession({ userId, tenantId });
    await expect(resolveSession(token)).resolves.not.toBeNull();

    await prisma.user.update({ where: { id: userId }, data: { isDeactivated: true } });
    await expect(resolveSession(token)).resolves.toBeNull();

    await prisma.user.update({
      where: { id: userId },
      data: { isDeactivated: false },
    });
  });

  it("révoque toutes les sessions sauf celle demandée", async () => {
    const first = await createSession({ userId, tenantId });
    const second = await createSession({ userId, tenantId });
    const third = await createSession({ userId, tenantId });

    const count = await revokeAllSessions(userId, third.sessionId);
    expect(count).toBeGreaterThanOrEqual(2);

    await expect(resolveSession(first.token)).resolves.toBeNull();
    await expect(resolveSession(second.token)).resolves.toBeNull();
    await expect(resolveSession(third.token)).resolves.not.toBeNull();
  });
});

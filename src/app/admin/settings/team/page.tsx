import {
  AccessDenied,
  PageHeader,
} from "@/components/admin/ui";
import {
  TeamManager,
  type PendingInvitation,
  type TeamMember,
} from "@/components/admin/team-manager";
import { can } from "@/server/auth/permissions";
import { requireSession } from "@/server/auth/session-context";
import { db } from "@/server/db";
import { withTenant } from "@/server/tenant-context";

export const metadata = { title: "Équipe" };

function toStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

export default async function TeamPage() {
  const session = await requireSession();

  if (!can(session, "user.view")) {
    return (
      <>
        <PageHeader title="Équipe" breadcrumb={["Accueil", "Réglages"]} />
        <AccessDenied />
      </>
    );
  }

  const { users, invitations } = await withTenant(session.tenantId, async () => {
    const [users, invitations] = await Promise.all([
      db.user.findMany({
        orderBy: [{ role: "asc" }, { name: "asc" }],
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          permissions: true,
          isDeactivated: true,
          lastLoginAt: true,
        },
      }),
      db.invitation.findMany({
        where: { acceptedAt: null, expiresAt: { gt: new Date() } },
        orderBy: { createdAt: "desc" },
        select: { id: true, email: true, role: true, expiresAt: true },
      }),
    ]);
    return { users, invitations };
  });

  const members: TeamMember[] = users.map((user) => ({
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    permissions: toStringArray(user.permissions),
    isDeactivated: user.isDeactivated,
    lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
    isSelf: user.id === session.userId,
  }));

  const pending: PendingInvitation[] = invitations.map((invitation) => ({
    id: invitation.id,
    email: invitation.email,
    role: invitation.role,
    expiresAt: invitation.expiresAt.toISOString(),
  }));

  return (
    <>
      <PageHeader
        title="Équipe"
        breadcrumb={["Accueil", "Réglages", "Équipe"]}
        description="Les membres partagent l'espace de l'agence. Les permissions sont vérifiées côté serveur, à chaque action."
      />
      <TeamManager
        members={members}
        invitations={pending}
        canInvite={can(session, "user.invite")}
        canEdit={can(session, "user.edit")}
        canRemove={can(session, "user.remove")}
      />
    </>
  );
}

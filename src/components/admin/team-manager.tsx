"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/input";
import {
  PERMISSION_GROUPS,
  PERMISSION_LABELS,
  ROLE_LABELS,
  type Permission,
} from "@/server/auth/permissions";
import {
  deactivateMemberAction,
  inviteMemberAction,
  reactivateMemberAction,
  updateMemberAction,
} from "@/server/actions/team";
import { IDLE_ACTION_STATE } from "@/server/actions/types";

export type TeamMember = {
  id: number;
  name: string;
  email: string;
  role: string;
  permissions: string[];
  isDeactivated: boolean;
  lastLoginAt: string | null;
  isSelf: boolean;
};

export type PendingInvitation = {
  id: number;
  email: string;
  role: string;
  expiresAt: string;
};

function Submit({ label, pendingLabel }: { label: string; pendingLabel: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? pendingLabel : label}
    </Button>
  );
}

function PermissionPicker({
  name,
  selected,
  disabled,
}: {
  name: string;
  selected: string[];
  disabled?: boolean;
}) {
  return (
    <fieldset className="space-y-3">
      <legend className="sr-only">Permissions</legend>
      {PERMISSION_GROUPS.map((group) => (
        <div key={group.key}>
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted">
            {group.label}
          </p>
          <div className="grid gap-1 sm:grid-cols-2">
            {group.permissions.map((permission) => (
              <label
                key={permission}
                className="flex items-start gap-2 text-[12px] text-body"
              >
                <input
                  type="checkbox"
                  name={name}
                  value={permission}
                  defaultChecked={selected.includes(permission)}
                  disabled={disabled}
                  className="mt-0.5 size-3.5 accent-[#F7941D]"
                />
                {PERMISSION_LABELS[permission as Permission] ?? permission}
              </label>
            ))}
          </div>
        </div>
      ))}
    </fieldset>
  );
}

export function TeamManager({
  members,
  invitations,
  canInvite,
  canEdit,
  canRemove,
}: {
  members: TeamMember[];
  invitations: PendingInvitation[];
  canInvite: boolean;
  canEdit: boolean;
  canRemove: boolean;
}) {
  const [inviteState, inviteAction] = useActionState(
    inviteMemberAction,
    IDLE_ACTION_STATE,
  );
  const [editState, editAction] = useActionState(
    updateMemberAction,
    IDLE_ACTION_STATE,
  );

  return (
    <div className="space-y-5">
      {canInvite ? (
        <section className="rounded-card border border-line bg-surface p-5">
          <h2 className="text-sm font-semibold text-ink">Inviter un membre</h2>
          <p className="mt-1 mb-4 text-[13px] text-body">
            Il recevra un lien valable 7 jours pour créer son compte.
          </p>

          <form action={inviteAction} className="space-y-4" noValidate>
            {inviteState.message ? (
              <Alert
                variant={inviteState.status === "success" ? "success" : "error"}
              >
                {inviteState.message}
              </Alert>
            ) : null}

            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label="Adresse email"
                htmlFor="invite-email"
                error={inviteState.fieldErrors?.email?.[0]}
              >
                <Input
                  id="invite-email"
                  name="email"
                  type="email"
                  required
                  placeholder="employe@agence.pf"
                />
              </Field>

              <Field label="Rôle" htmlFor="invite-role">
                <select
                  id="invite-role"
                  name="role"
                  defaultValue="member"
                  className="h-10 w-full rounded-btn border border-line bg-surface px-3 text-sm text-ink"
                >
                  <option value="member">{ROLE_LABELS.member}</option>
                  <option value="admin">{ROLE_LABELS.admin}</option>
                </select>
              </Field>
            </div>

            <details className="rounded-btn border border-line p-3">
              <summary className="cursor-pointer text-[13px] font-medium text-ink">
                Permissions accordées
              </summary>
              <div className="mt-3">
                <PermissionPicker name="permissions" selected={[]} />
              </div>
            </details>

            <div className="flex justify-end">
              <Submit label="Envoyer l'invitation" pendingLabel="Envoi…" />
            </div>
          </form>
        </section>
      ) : null}

      {invitations.length > 0 ? (
        <section className="rounded-card border border-line bg-surface p-5">
          <h2 className="mb-3 text-sm font-semibold text-ink">
            Invitations en attente
          </h2>
          <ul className="divide-y divide-line">
            {invitations.map((invitation) => (
              <li
                key={invitation.id}
                className="flex flex-wrap items-center justify-between gap-2 py-2 text-[13px]"
              >
                <span className="text-ink">{invitation.email}</span>
                <span className="text-muted">
                  {ROLE_LABELS[invitation.role] ?? invitation.role} · expire le{" "}
                  {new Date(invitation.expiresAt).toLocaleDateString("fr-FR", {
                    timeZone: "Pacific/Tahiti",
                  })}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="rounded-card border border-line bg-surface">
        <div className="border-b border-line px-5 py-4">
          <h2 className="text-sm font-semibold text-ink">Membres de l&apos;équipe</h2>
          {editState.message ? (
            <div className="mt-3">
              <Alert
                variant={editState.status === "success" ? "success" : "error"}
              >
                {editState.message}
              </Alert>
            </div>
          ) : null}
        </div>

        <ul className="divide-y divide-line">
          {members.map((member) => (
            <li key={member.id} className="px-5 py-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-[13px] font-semibold text-ink">
                    {member.name}
                    {member.isSelf ? (
                      <span className="ml-2 text-[11px] font-normal text-muted">
                        (vous)
                      </span>
                    ) : null}
                  </p>
                  <p className="truncate text-xs text-muted">{member.email}</p>
                </div>

                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-brand-soft px-2.5 py-0.5 text-[11px] font-semibold text-ink">
                    {ROLE_LABELS[member.role] ?? member.role}
                  </span>
                  {member.isDeactivated ? (
                    <span className="rounded-full bg-line px-2.5 py-0.5 text-[11px] font-semibold text-body">
                      Désactivé
                    </span>
                  ) : null}
                  <span className="text-[11px] text-muted">
                    {member.permissions.length} permission
                    {member.permissions.length > 1 ? "s" : ""}
                  </span>
                </div>
              </div>

              {member.role !== "owner" ? (
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  {canEdit ? (
                    <details className="w-full">
                      <summary className="cursor-pointer text-[12px] font-medium text-brand-text">
                        Modifier le rôle et les permissions
                      </summary>
                      <form action={editAction} className="mt-3 space-y-3">
                        <input type="hidden" name="userId" value={member.id} />
                        <div className="max-w-[220px]">
                          <label
                            htmlFor={`role-${member.id}`}
                            className="mb-1 block text-[12px] font-medium text-ink"
                          >
                            Rôle
                          </label>
                          <select
                            id={`role-${member.id}`}
                            name="role"
                            defaultValue={member.role}
                            className="h-9 w-full rounded-btn border border-line bg-surface px-2 text-[13px] text-ink"
                          >
                            <option value="member">{ROLE_LABELS.member}</option>
                            <option value="admin">{ROLE_LABELS.admin}</option>
                          </select>
                        </div>
                        <PermissionPicker
                          name="permissions"
                          selected={member.permissions}
                        />
                        <div className="flex gap-2">
                          <Submit label="Enregistrer" pendingLabel="…" />
                        </div>
                      </form>
                    </details>
                  ) : null}

                  {canRemove ? (
                    member.isDeactivated ? (
                      <form action={reactivateMemberAction}>
                        <input type="hidden" name="userId" value={member.id} />
                        <Button type="submit" variant="secondary" size="sm">
                          Réactiver
                        </Button>
                      </form>
                    ) : (
                      <form action={deactivateMemberAction}>
                        <input type="hidden" name="userId" value={member.id} />
                        <Button type="submit" variant="secondary" size="sm">
                          Désactiver
                        </Button>
                      </form>
                    )
                  ) : null}
                </div>
              ) : (
                <p className="mt-1 text-[11px] text-muted">
                  Propriétaire : accès complet, non modifiable.
                </p>
              )}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

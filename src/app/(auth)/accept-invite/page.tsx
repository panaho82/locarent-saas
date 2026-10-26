import type { Metadata } from "next";
import Link from "next/link";
import { AcceptInviteForm } from "@/components/auth/forms";
import { Alert } from "@/components/ui/card";
import { getInvitationPreview } from "@/server/actions/auth";

export const metadata: Metadata = { title: "Rejoindre une agence" };

const REASONS: Record<string, string> = {
  introuvable: "Ce lien d'invitation n'existe pas ou a été révoqué.",
  expiree: "Cette invitation a expiré. Demandez-en une nouvelle.",
  "deja-acceptee": "Cette invitation a déjà été utilisée.",
};

export default async function AcceptInvitePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const token = typeof params.token === "string" ? params.token : "";
  const invitation = await getInvitationPreview(token);

  if (!invitation.ok) {
    return (
      <div>
        <h1 className="text-2xl font-bold text-ink">Invitation invalide</h1>
        <div className="mt-6">
          <Alert variant="error">
            {REASONS[invitation.reason ?? "introuvable"] ??
              "Cette invitation n'est pas valable."}
          </Alert>
        </div>
        <p className="mt-6 text-center text-[13px]">
          <Link
            href="/login"
            className="font-medium text-brand-text hover:underline"
          >
            Aller à la connexion
          </Link>
        </p>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-ink">
        Rejoindre {invitation.tenantName}
      </h1>
      <p className="mt-2 mb-8 text-sm text-body">
        Vous avez été invité(e) à collaborer sur cet espace. Choisissez votre
        nom et un mot de passe pour activer votre compte.
      </p>
      <AcceptInviteForm token={token} email={invitation.email ?? ""} />
    </div>
  );
}

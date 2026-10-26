import type { Metadata } from "next";
import Link from "next/link";
import { ResetPasswordForm } from "@/components/auth/forms";
import { Alert } from "@/components/ui/card";

export const metadata: Metadata = { title: "Nouveau mot de passe" };

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const token = typeof params.token === "string" ? params.token : "";

  if (!token) {
    return (
      <div>
        <h1 className="text-2xl font-bold text-ink">Lien invalide</h1>
        <div className="mt-6">
          <Alert variant="error">
            Ce lien de réinitialisation est incomplet. Refaites une demande
            depuis la page « Mot de passe oublié ».
          </Alert>
        </div>
        <p className="mt-6 text-center text-[13px]">
          <Link
            href="/forgot-password"
            className="font-medium text-brand-dark hover:underline"
          >
            Refaire une demande
          </Link>
        </p>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-ink">Nouveau mot de passe</h1>
      <p className="mt-2 mb-8 text-sm text-body">
        Choisissez un mot de passe solide. Vos autres sessions seront fermées.
      </p>
      <ResetPasswordForm token={token} />
    </div>
  );
}

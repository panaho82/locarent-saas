import type { Metadata } from "next";
import { LoginForm } from "@/components/auth/forms";
import { redirectIfAuthenticated } from "@/server/auth/session-context";

export const metadata: Metadata = { title: "Connexion" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await redirectIfAuthenticated();
  const params = await searchParams;

  const notice =
    params.reset === "1"
      ? "Votre mot de passe a été modifié. Connectez-vous avec le nouveau."
      : undefined;

  return (
    <div>
      <h1 className="text-2xl font-bold text-ink">Connexion</h1>
      <p className="mt-2 mb-8 text-sm text-body">
        Accédez à l&apos;espace de votre agence.
      </p>
      <LoginForm notice={notice} />
    </div>
  );
}

import type { Metadata } from "next";
import { RegisterForm } from "@/components/auth/forms";
import { redirectIfAuthenticated } from "@/server/auth/session-context";

export const metadata: Metadata = { title: "Créer une agence" };

export default async function RegisterPage() {
  await redirectIfAuthenticated();

  return (
    <div>
      <h1 className="text-2xl font-bold text-ink">Créer votre agence</h1>
      <p className="mt-2 mb-8 text-sm text-body">
        Un mois d&apos;essai, sans engagement, sans carte bancaire.
      </p>
      <RegisterForm />
    </div>
  );
}

import type { Metadata } from "next";
import { ForgotPasswordForm } from "@/components/auth/forms";

export const metadata: Metadata = { title: "Mot de passe oublié" };

export default function ForgotPasswordPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold text-ink">Mot de passe oublié</h1>
      <p className="mt-2 mb-8 text-sm text-body">
        Indiquez votre adresse email : nous vous envoyons un lien de
        réinitialisation valable une heure.
      </p>
      <ForgotPasswordForm />
    </div>
  );
}

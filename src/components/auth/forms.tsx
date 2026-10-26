"use client";

import Link from "next/link";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/input";
import {
  acceptInviteAction,
  forgotPasswordAction,
  loginAction,
  registerAction,
  resetPasswordAction,
} from "@/server/actions/auth";
import { IDLE_AUTH_STATE, type AuthActionState } from "@/server/actions/types";

/**
 * Formulaires d'authentification.
 *
 * Tous suivent le même schéma : `useActionState` côté client, validation
 * définitive côté serveur, erreurs renvoyées par champ ou globalement.
 */

function SubmitButton({ children }: { children: React.ReactNode }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="lg" disabled={pending}>
      {pending ? "Un instant…" : children}
    </Button>
  );
}

function FormFeedback({ state }: { state: AuthActionState }) {
  if (!state.message) return null;
  return (
    <Alert variant={state.status === "success" ? "success" : "error"}>
      {state.message}
    </Alert>
  );
}

function fieldError(state: AuthActionState, name: string): string | undefined {
  return state.fieldErrors?.[name]?.[0];
}

export function LoginForm({ notice }: { notice?: string }) {
  const [state, formAction] = useActionState(loginAction, IDLE_AUTH_STATE);

  return (
    <form action={formAction} className="space-y-4" noValidate>
      {notice ? <Alert variant="success">{notice}</Alert> : null}
      <FormFeedback state={state} />

      <Field label="Adresse email" htmlFor="email" error={fieldError(state, "email")}>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          placeholder="vous@agence.pf"
          invalid={Boolean(fieldError(state, "email"))}
        />
      </Field>

      <Field
        label="Mot de passe"
        htmlFor="password"
        error={fieldError(state, "password")}
      >
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          invalid={Boolean(fieldError(state, "password"))}
        />
      </Field>

      <div className="flex justify-end">
        <Link
          href="/forgot-password"
          className="text-[13px] font-medium text-brand-dark hover:underline"
        >
          Mot de passe oublié ?
        </Link>
      </div>

      <SubmitButton>Se connecter</SubmitButton>

      <p className="text-center text-[13px] text-muted">
        Pas encore de compte ?{" "}
        <Link href="/register" className="font-medium text-brand-dark hover:underline">
          Créer une agence
        </Link>
      </p>
    </form>
  );
}

export function RegisterForm() {
  const [state, formAction] = useActionState(registerAction, IDLE_AUTH_STATE);

  return (
    <form action={formAction} className="space-y-4" noValidate>
      <FormFeedback state={state} />

      <Field
        label="Nom de l'agence"
        htmlFor="tenantName"
        error={fieldError(state, "tenantName")}
        hint="Apparaîtra sur vos factures et votre page de réservation."
      >
        <Input
          id="tenantName"
          name="tenantName"
          required
          autoComplete="organization"
          placeholder="Raiatea Rent Car"
          invalid={Boolean(fieldError(state, "tenantName"))}
        />
      </Field>

      <Field label="Votre nom" htmlFor="name" error={fieldError(state, "name")}>
        <Input
          id="name"
          name="name"
          required
          autoComplete="name"
          invalid={Boolean(fieldError(state, "name"))}
        />
      </Field>

      <Field label="Adresse email" htmlFor="email" error={fieldError(state, "email")}>
        <Input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          invalid={Boolean(fieldError(state, "email"))}
        />
      </Field>

      <Field
        label="Mot de passe"
        htmlFor="password"
        error={fieldError(state, "password")}
        hint="10 caractères minimum."
      >
        <Input
          id="password"
          name="password"
          type="password"
          required
          autoComplete="new-password"
          invalid={Boolean(fieldError(state, "password"))}
        />
      </Field>

      <Field
        label="Confirmer le mot de passe"
        htmlFor="passwordConfirmation"
        error={fieldError(state, "passwordConfirmation")}
      >
        <Input
          id="passwordConfirmation"
          name="passwordConfirmation"
          type="password"
          required
          autoComplete="new-password"
          invalid={Boolean(fieldError(state, "passwordConfirmation"))}
        />
      </Field>

      <SubmitButton>Créer mon agence</SubmitButton>

      <p className="text-center text-[13px] text-muted">
        Déjà un compte ?{" "}
        <Link href="/login" className="font-medium text-brand-dark hover:underline">
          Se connecter
        </Link>
      </p>
    </form>
  );
}

export function ForgotPasswordForm() {
  const [state, formAction] = useActionState(
    forgotPasswordAction,
    IDLE_AUTH_STATE,
  );

  return (
    <form action={formAction} className="space-y-4" noValidate>
      <FormFeedback state={state} />

      <Field label="Adresse email" htmlFor="email" error={fieldError(state, "email")}>
        <Input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          invalid={Boolean(fieldError(state, "email"))}
        />
      </Field>

      <SubmitButton>Recevoir un lien</SubmitButton>

      <p className="text-center text-[13px] text-muted">
        <Link href="/login" className="font-medium text-brand-dark hover:underline">
          Retour à la connexion
        </Link>
      </p>
    </form>
  );
}

export function ResetPasswordForm({ token }: { token: string }) {
  const [state, formAction] = useActionState(resetPasswordAction, IDLE_AUTH_STATE);

  return (
    <form action={formAction} className="space-y-4" noValidate>
      <input type="hidden" name="token" value={token} />
      <FormFeedback state={state} />

      <Field
        label="Nouveau mot de passe"
        htmlFor="password"
        error={fieldError(state, "password")}
        hint="10 caractères minimum. Vos autres sessions seront déconnectées."
      >
        <Input
          id="password"
          name="password"
          type="password"
          required
          autoComplete="new-password"
          invalid={Boolean(fieldError(state, "password"))}
        />
      </Field>

      <Field
        label="Confirmer le mot de passe"
        htmlFor="passwordConfirmation"
        error={fieldError(state, "passwordConfirmation")}
      >
        <Input
          id="passwordConfirmation"
          name="passwordConfirmation"
          type="password"
          required
          autoComplete="new-password"
          invalid={Boolean(fieldError(state, "passwordConfirmation"))}
        />
      </Field>

      <SubmitButton>Enregistrer le mot de passe</SubmitButton>
    </form>
  );
}

export function AcceptInviteForm({
  token,
  email,
}: {
  token: string;
  email: string;
}) {
  const [state, formAction] = useActionState(acceptInviteAction, IDLE_AUTH_STATE);

  return (
    <form action={formAction} className="space-y-4" noValidate>
      <input type="hidden" name="token" value={token} />
      <FormFeedback state={state} />

      <Field label="Adresse email" htmlFor="invited-email">
        <Input id="invited-email" value={email} readOnly disabled />
      </Field>

      <Field label="Votre nom" htmlFor="name" error={fieldError(state, "name")}>
        <Input
          id="name"
          name="name"
          required
          autoComplete="name"
          invalid={Boolean(fieldError(state, "name"))}
        />
      </Field>

      <Field
        label="Mot de passe"
        htmlFor="password"
        error={fieldError(state, "password")}
        hint="10 caractères minimum."
      >
        <Input
          id="password"
          name="password"
          type="password"
          required
          autoComplete="new-password"
          invalid={Boolean(fieldError(state, "password"))}
        />
      </Field>

      <Field
        label="Confirmer le mot de passe"
        htmlFor="passwordConfirmation"
        error={fieldError(state, "passwordConfirmation")}
      >
        <Input
          id="passwordConfirmation"
          name="passwordConfirmation"
          type="password"
          required
          autoComplete="new-password"
          invalid={Boolean(fieldError(state, "passwordConfirmation"))}
        />
      </Field>

      <SubmitButton>Rejoindre l&apos;agence</SubmitButton>
    </form>
  );
}

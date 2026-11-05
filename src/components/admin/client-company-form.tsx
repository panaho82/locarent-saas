"use client";

import Link from "next/link";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/input";
import {
  createCompanyAction,
  updateCompanyAction,
} from "@/server/actions/customers";
import { IDLE_ACTION_STATE } from "@/server/actions/types";

/**
 * Formulaire « entreprise cliente » (personne morale qui loue).
 * À ne pas confondre avec `company-form.tsx`, qui configure l'agence elle-même.
 */

export type ClientCompanyValues = {
  id?: number;
  name: string;
  contactName: string;
  email: string;
  phone: string;
  address: string;
  zipcode: string;
  city: string;
  country: string;
  taxId: string;
  notes: string;
};

const FIELD_LABELS: Record<string, string> = {
  name: "Nom",
  contactName: "Contact",
  email: "Email",
  phone: "Téléphone",
  address: "Adresse",
  zipcode: "Code postal",
  city: "Commune",
  country: "Pays",
  taxId: "N° TAHITI",
};

function Submit({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Enregistrement…" : label}
    </Button>
  );
}

export function ClientCompanyForm({
  mode,
  values,
}: {
  mode: "create" | "edit";
  values: ClientCompanyValues;
}) {
  const action = mode === "create" ? createCompanyAction : updateCompanyAction;
  const [state, formAction] = useActionState(action, IDLE_ACTION_STATE);
  const error = (name: string) => state.fieldErrors?.[name]?.[0];
  const invalid = [...new Set(Object.keys(state.fieldErrors ?? {}).map((k) => FIELD_LABELS[k] ?? k))];

  return (
    <form action={formAction} noValidate>
      {values.id ? <input type="hidden" name="companyId" value={values.id} /> : null}

      <div className="rounded-card border border-line bg-surface p-5">
        {state.status !== "idle" ? (
          <div className="mb-4">
            <Alert variant={state.status === "success" ? "success" : "error"}>
              {state.message ??
                (invalid.length > 0
                  ? `Champs à corriger : ${invalid.join(", ")}.`
                  : "Certains champs sont invalides.")}
            </Alert>
          </div>
        ) : null}

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Nom de l'entreprise *" htmlFor="name" error={error("name")}>
            <Input id="name" name="name" defaultValue={values.name} required
              invalid={Boolean(error("name"))} />
          </Field>

          <Field label="Contact" htmlFor="contactName" error={error("contactName")}>
            <Input id="contactName" name="contactName" defaultValue={values.contactName} />
          </Field>

          <Field label="Email" htmlFor="email" error={error("email")}>
            <Input id="email" name="email" type="email" defaultValue={values.email}
              invalid={Boolean(error("email"))} />
          </Field>

          <Field label="Téléphone" htmlFor="phone" error={error("phone")}>
            <Input id="phone" name="phone" defaultValue={values.phone} />
          </Field>

          <Field label="N° TAHITI (identifiant fiscal)" htmlFor="taxId" error={error("taxId")}>
            <Input id="taxId" name="taxId" defaultValue={values.taxId} />
          </Field>

          <Field label="Adresse" htmlFor="address" error={error("address")}>
            <Input id="address" name="address" defaultValue={values.address} />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Code postal" htmlFor="zipcode" error={error("zipcode")}>
              <Input id="zipcode" name="zipcode" defaultValue={values.zipcode} />
            </Field>
            <Field label="Commune" htmlFor="city" error={error("city")}>
              <Input id="city" name="city" defaultValue={values.city} />
            </Field>
          </div>

          <Field label="Pays" htmlFor="country" error={error("country")}>
            <Input id="country" name="country" defaultValue={values.country || "Polynésie française"} />
          </Field>

          <Field label="Notes internes" htmlFor="notes" error={error("notes")}>
            <Input id="notes" name="notes" defaultValue={values.notes} />
          </Field>
        </div>

        <div className="mt-5 flex justify-end gap-2 border-t border-line pt-4">
          <Link href="/admin/customers?tab=companies" className="text-[13px] text-body hover:text-ink">
            Annuler
          </Link>
          <Submit label={mode === "create" ? "Ajouter l'entreprise" : "Enregistrer"} />
        </div>
      </div>
    </form>
  );
}

"use client";

import Link from "next/link";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/input";
import {
  createCustomerAction,
  updateCustomerAction,
} from "@/server/actions/customers";
import { IDLE_ACTION_STATE } from "@/server/actions/types";

export type CustomerValues = {
  id?: number;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  address: string;
  zipcode: string;
  city: string;
  country: string;
  notes: string;
  isInsurance: boolean;
};

const FIELD_LABELS: Record<string, string> = {
  firstName: "Prénom",
  lastName: "Nom",
  email: "Email",
  phone: "Téléphone",
  address: "Adresse",
  zipcode: "Code postal",
  city: "Commune",
  country: "Pays",
};

function Submit({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Enregistrement…" : label}
    </Button>
  );
}

export function CustomerForm({
  mode,
  values,
}: {
  mode: "create" | "edit";
  values: CustomerValues;
}) {
  const action = mode === "create" ? createCustomerAction : updateCustomerAction;
  const [state, formAction] = useActionState(action, IDLE_ACTION_STATE);
  const error = (name: string) => state.fieldErrors?.[name]?.[0];
  const invalid = [...new Set(Object.keys(state.fieldErrors ?? {}).map((k) => FIELD_LABELS[k] ?? k))];

  return (
    <form action={formAction} noValidate>
      {values.id ? <input type="hidden" name="customerId" value={values.id} /> : null}

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
          <Field label="Prénom *" htmlFor="firstName" error={error("firstName")}>
            <Input id="firstName" name="firstName" defaultValue={values.firstName} required
              invalid={Boolean(error("firstName"))} />
          </Field>

          <Field label="Nom *" htmlFor="lastName" error={error("lastName")}>
            <Input id="lastName" name="lastName" defaultValue={values.lastName} required
              invalid={Boolean(error("lastName"))} />
          </Field>

          <Field label="Email" htmlFor="email" error={error("email")}>
            <Input id="email" name="email" type="email" defaultValue={values.email}
              placeholder="client@exemple.pf" invalid={Boolean(error("email"))} />
          </Field>

          <Field label="Téléphone" htmlFor="phone" error={error("phone")}>
            <Input id="phone" name="phone" defaultValue={values.phone} placeholder="+689 89 43 09 86" />
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

        <div className="mt-4 border-t border-line pt-4">
          <label className="flex items-center gap-2 text-[13px] text-ink">
            <input type="checkbox" name="isInsurance" defaultChecked={values.isInsurance}
              className="size-4 accent-[#1D4ED8]" />
            Client assurances (prise en charge par un assureur)
          </label>
        </div>

        <div className="mt-5 flex justify-end gap-2 border-t border-line pt-4">
          <Link href="/admin/customers" className="text-[13px] text-body hover:text-ink">
            Annuler
          </Link>
          <Submit label={mode === "create" ? "Ajouter le client" : "Enregistrer"} />
        </div>
      </div>
    </form>
  );
}

export { ArrowLeft };

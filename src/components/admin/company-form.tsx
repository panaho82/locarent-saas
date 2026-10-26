"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/input";
import { updateCompanyAction } from "@/server/actions/company";
import { IDLE_ACTION_STATE } from "@/server/actions/types";

export type CompanyValues = {
  name: string;
  managerName: string;
  email: string;
  phone: string;
  tahitiNumber: string;
  address: string;
  city: string;
  zipcode: string;
  island: string;
  companyTagline: string;
  primaryColor: string;
};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Enregistrement…" : "Enregistrer"}
    </Button>
  );
}

/** Réglages « Entreprise ». */
export function CompanyForm({
  values,
  canEdit,
}: {
  values: CompanyValues;
  canEdit: boolean;
}) {
  const [state, formAction] = useActionState(
    updateCompanyAction,
    IDLE_ACTION_STATE,
  );

  const error = (name: keyof CompanyValues | string) =>
    state.fieldErrors?.[name]?.[0];

  return (
    <form action={formAction} className="space-y-4" noValidate>
      {state.message ? (
        <Alert variant={state.status === "success" ? "success" : "error"}>
          {state.message}
        </Alert>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Nom de l'agence" htmlFor="name" error={error("name")}>
          <Input
            id="name"
            name="name"
            defaultValue={values.name}
            required
            disabled={!canEdit}
            invalid={Boolean(error("name"))}
          />
        </Field>

        <Field
          label="Responsable"
          htmlFor="managerName"
          error={error("managerName")}
        >
          <Input
            id="managerName"
            name="managerName"
            defaultValue={values.managerName}
            disabled={!canEdit}
          />
        </Field>

        <Field label="Email" htmlFor="email" error={error("email")}>
          <Input
            id="email"
            name="email"
            type="email"
            defaultValue={values.email}
            required
            disabled={!canEdit}
            invalid={Boolean(error("email"))}
          />
        </Field>

        <Field label="Téléphone" htmlFor="phone" error={error("phone")}>
          <Input
            id="phone"
            name="phone"
            defaultValue={values.phone}
            placeholder="+689 87 00 00 00"
            disabled={!canEdit}
          />
        </Field>

        <Field
          label="N° TAHITI (identifiant fiscal)"
          htmlFor="tahitiNumber"
          hint="Apparaît sur les factures."
          error={error("tahitiNumber")}
        >
          <Input
            id="tahitiNumber"
            name="tahitiNumber"
            defaultValue={values.tahitiNumber}
            disabled={!canEdit}
          />
        </Field>

        <Field label="Île" htmlFor="island" error={error("island")}>
          <Input
            id="island"
            name="island"
            defaultValue={values.island}
            placeholder="Raiatea"
            disabled={!canEdit}
          />
        </Field>

        <Field label="Adresse" htmlFor="address" error={error("address")}>
          <Input
            id="address"
            name="address"
            defaultValue={values.address}
            disabled={!canEdit}
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Code postal" htmlFor="zipcode" error={error("zipcode")}>
            <Input
              id="zipcode"
              name="zipcode"
              defaultValue={values.zipcode}
              disabled={!canEdit}
            />
          </Field>
          <Field label="Commune" htmlFor="city" error={error("city")}>
            <Input
              id="city"
              name="city"
              defaultValue={values.city}
              disabled={!canEdit}
            />
          </Field>
        </div>

        <Field
          label="Accroche"
          htmlFor="companyTagline"
          hint="Une phrase affichée sur votre page publique."
          error={error("companyTagline")}
        >
          <Input
            id="companyTagline"
            name="companyTagline"
            defaultValue={values.companyTagline}
            disabled={!canEdit}
          />
        </Field>

        <Field
          label="Couleur principale"
          htmlFor="primaryColor"
          error={error("primaryColor")}
        >
          <div className="flex items-center gap-2">
            <input
              id="primaryColor"
              name="primaryColor"
              type="color"
              defaultValue={values.primaryColor}
              disabled={!canEdit}
              className="h-10 w-14 rounded-btn border border-line bg-surface p-1"
            />
            <span className="text-xs text-muted">{values.primaryColor}</span>
          </div>
        </Field>
      </div>

      {canEdit ? (
        <div className="flex justify-end pt-2">
          <SubmitButton />
        </div>
      ) : (
        <Alert variant="info">
          Votre rôle permet de consulter ces réglages, pas de les modifier.
        </Alert>
      )}
    </form>
  );
}

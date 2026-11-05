"use client";

import Link from "next/link";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { ArrowLeft, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/input";
import {
  createLocationAction,
  deleteLocationAction,
  updateLocationAction,
} from "@/server/actions/catalog";
import { IDLE_ACTION_STATE } from "@/server/actions/types";

export type LocationValues = {
  id?: number;
  name: string;
  address: string;
  island: string;
  openingHours: string;
  price: string;
  isFree: boolean;
  isPublic: boolean;
  isDefault: boolean;
};

const FIELD_LABELS: Record<string, string> = {
  name: "Nom",
  address: "Adresse",
  island: "Île",
  openingHours: "Horaires",
  price: "Frais supplémentaires",
};

function Submit({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Enregistrement…" : label}
    </Button>
  );
}

export function LocationForm({
  mode,
  values,
}: {
  mode: "create" | "edit";
  values: LocationValues;
}) {
  const action = mode === "create" ? createLocationAction : updateLocationAction;
  const [state, formAction] = useActionState(action, IDLE_ACTION_STATE);
  const error = (name: string) => state.fieldErrors?.[name]?.[0];
  const invalid = [...new Set(Object.keys(state.fieldErrors ?? {}).map((k) => FIELD_LABELS[k] ?? k))];

  return (
    <div>
      <Link
        href="/admin/locations"
        className="mb-4 inline-flex items-center gap-1.5 text-[13px] text-body hover:text-ink"
      >
        <ArrowLeft className="size-3.5" aria-hidden />
        Retour
      </Link>

      <form action={formAction} noValidate>
        {values.id ? <input type="hidden" name="locationId" value={values.id} /> : null}

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
            <Field label="Nom *" htmlFor="name" error={error("name")}>
              <Input id="name" name="name" defaultValue={values.name} required
                placeholder="Agence Raiatea Rent Car" invalid={Boolean(error("name"))} />
            </Field>

            <Field label="Adresse" htmlFor="address" error={error("address")}>
              <Input id="address" name="address" defaultValue={values.address}
                placeholder="Quai des Pêcheurs, Uturoa" />
            </Field>

            <Field label="Île" htmlFor="island" error={error("island")}>
              <Input id="island" name="island" defaultValue={values.island} placeholder="Raiatea" />
            </Field>

            <Field label="Horaires d'ouverture" htmlFor="openingHours" error={error("openingHours")}>
              <Input id="openingHours" name="openingHours" defaultValue={values.openingHours}
                placeholder="Lun–Sam 8h–17h" />
            </Field>

            <Field
              label="Frais supplémentaires (XPF)"
              htmlFor="price"
              hint="Facturés si le client récupère le véhicule ici."
              error={error("price")}
            >
              <Input id="price" name="price" inputMode="numeric" defaultValue={values.price} />
            </Field>
          </div>

          <div className="mt-5 space-y-2 border-t border-line pt-4">
            <label className="flex items-center gap-2 text-[13px] text-ink">
              <input type="checkbox" name="isFree" defaultChecked={values.isFree}
                className="size-4 accent-[#1D4ED8]" />
              Gratuit
            </label>
            <label className="flex items-center gap-2 text-[13px] text-ink">
              <input type="checkbox" name="isPublic" defaultChecked={values.isPublic}
                className="size-4 accent-[#1D4ED8]" />
              Proposé sur la page de réservation en ligne
            </label>
            <label className="flex items-center gap-2 text-[13px] text-ink">
              <input type="checkbox" name="isDefault" defaultChecked={values.isDefault}
                className="size-4 accent-[#1D4ED8]" />
              Emplacement par défaut
            </label>
          </div>

          <div className="mt-5 flex justify-end gap-2 border-t border-line pt-4">
            <Link href="/admin/locations" className="text-[13px] text-body hover:text-ink">
              Annuler
            </Link>
            <Submit label={mode === "create" ? "Ajouter l'emplacement" : "Enregistrer"} />
          </div>
        </div>
      </form>

      {mode === "edit" && values.id ? (
        <form action={deleteLocationAction} className="mt-4 flex justify-end">
          <input type="hidden" name="locationId" value={values.id} />
          <Button type="submit" variant="secondary" size="sm">
            <Trash2 className="size-4" aria-hidden />
            Supprimer cet emplacement
          </Button>
        </form>
      ) : null}
    </div>
  );
}

"use client";

import Link from "next/link";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { ArrowLeft, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/input";
import {
  createExtraServiceAction,
  deleteExtraServiceAction,
  updateExtraServiceAction,
} from "@/server/actions/catalog";
import { IDLE_ACTION_STATE } from "@/server/actions/types";

export type ExtraServiceValues = {
  id?: number;
  name: string;
  description: string;
  price: string;
  priceType: "per_day" | "per_rental";
  maxQty: string;
  isActive: boolean;
};

const FIELD_LABELS: Record<string, string> = {
  name: "Nom",
  description: "Description",
  price: "Prix TTC",
  priceType: "Type",
  maxQty: "Quantité maximale",
};

function Submit({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Enregistrement…" : label}
    </Button>
  );
}

export function ExtraServiceForm({
  mode,
  values,
}: {
  mode: "create" | "edit";
  values: ExtraServiceValues;
}) {
  const action = mode === "create" ? createExtraServiceAction : updateExtraServiceAction;
  const [state, formAction] = useActionState(action, IDLE_ACTION_STATE);
  const error = (name: string) => state.fieldErrors?.[name]?.[0];
  const invalid = [...new Set(Object.keys(state.fieldErrors ?? {}).map((k) => FIELD_LABELS[k] ?? k))];

  return (
    <div>
      <Link
        href="/admin/extra-services"
        className="mb-4 inline-flex items-center gap-1.5 text-[13px] text-body hover:text-ink"
      >
        <ArrowLeft className="size-3.5" aria-hidden />
        Retour
      </Link>

      <form action={formAction} noValidate>
        {values.id ? <input type="hidden" name="extraServiceId" value={values.id} /> : null}

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
                placeholder="GPS" invalid={Boolean(error("name"))} />
            </Field>

            <Field label="Description" htmlFor="description" error={error("description")}>
              <Input id="description" name="description" defaultValue={values.description}
                placeholder="Navigation GPS portable" />
            </Field>

            <Field label="Prix TTC (XPF) *" htmlFor="price" error={error("price")}>
              <Input id="price" name="price" inputMode="numeric" required
                defaultValue={values.price} invalid={Boolean(error("price"))} />
            </Field>

            <Field label="Type" htmlFor="priceType" error={error("priceType")}>
              <select
                id="priceType"
                name="priceType"
                defaultValue={values.priceType}
                className="h-10 w-full rounded-btn border border-line bg-surface px-3 text-sm text-ink"
              >
                <option value="per_day">Par jour</option>
                <option value="per_rental">Unique (par location)</option>
              </select>
            </Field>

            <Field
              label="Quantité maximale"
              htmlFor="maxQty"
              hint="Vide = pas de limite."
              error={error("maxQty")}
            >
              <Input id="maxQty" name="maxQty" inputMode="numeric" defaultValue={values.maxQty} />
            </Field>
          </div>

          <div className="mt-5 border-t border-line pt-4">
            <label className="flex items-center gap-2 text-[13px] text-ink">
              <input type="checkbox" name="isActive" defaultChecked={values.isActive}
                className="size-4 accent-[#1D4ED8]" />
              Proposé aux clients (décocher pour le rendre interne)
            </label>
          </div>

          <div className="mt-5 flex justify-end gap-2 border-t border-line pt-4">
            <Link href="/admin/extra-services" className="text-[13px] text-body hover:text-ink">
              Annuler
            </Link>
            <Submit label={mode === "create" ? "Ajouter le service" : "Enregistrer"} />
          </div>
        </div>
      </form>

      {mode === "edit" && values.id ? (
        <form action={deleteExtraServiceAction} className="mt-4 flex justify-end">
          <input type="hidden" name="extraServiceId" value={values.id} />
          <Button type="submit" variant="secondary" size="sm">
            <Trash2 className="size-4" aria-hidden />
            Supprimer ce service
          </Button>
        </form>
      ) : null}
    </div>
  );
}

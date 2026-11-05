"use client";

import Link from "next/link";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { ArrowLeft, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/input";
import {
  createMaintenanceAction,
  deleteMaintenanceAction,
  updateMaintenanceAction,
} from "@/server/actions/maintenance";
import {
  MAINTENANCE_STATUSES,
  MAINTENANCE_STATUS_LABELS,
  MAINTENANCE_TYPES,
  MAINTENANCE_TYPE_LABELS,
} from "@/lib/validation/maintenance";
import { IDLE_ACTION_STATE } from "@/server/actions/types";

export type MaintenanceValues = {
  id?: number;
  vehicleId: string;
  type: string;
  status: string;
  title: string;
  description: string;
  cost: string;
  mileage: string;
  performedAt: string;
  nextDueDate: string;
  nextDueMileage: string;
  garage: string;
};

const FIELD_LABELS: Record<string, string> = {
  vehicleId: "Véhicule",
  type: "Type",
  status: "Statut",
  title: "Titre",
  cost: "Coût",
  mileage: "Kilométrage",
  performedAt: "Date d'intervention",
  nextDueDate: "Prochaine échéance",
  nextDueMileage: "Échéance kilométrique",
  garage: "Garage",
};

const selectClass =
  "h-10 w-full rounded-btn border border-line bg-surface px-3 text-sm text-ink";

function Submit({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Enregistrement…" : label}
    </Button>
  );
}

export function MaintenanceForm({
  mode,
  values,
  vehicles,
}: {
  mode: "create" | "edit";
  values: MaintenanceValues;
  vehicles: { id: number; name: string; licensePlate: string }[];
}) {
  const action = mode === "create" ? createMaintenanceAction : updateMaintenanceAction;
  const [state, formAction] = useActionState(action, IDLE_ACTION_STATE);
  const error = (name: string) => state.fieldErrors?.[name]?.[0];
  const invalid = [...new Set(Object.keys(state.fieldErrors ?? {}).map((k) => FIELD_LABELS[k] ?? k))];

  return (
    <div>
      <Link
        href="/admin/maintenance"
        className="mb-4 inline-flex items-center gap-1.5 text-[13px] text-body hover:text-ink"
      >
        <ArrowLeft className="size-3.5" aria-hidden />
        Retour
      </Link>

      <form action={formAction} noValidate>
        {values.id ? <input type="hidden" name="maintenanceId" value={values.id} /> : null}

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

          {vehicles.length === 0 ? (
            <Alert variant="warning">
              Aucun véhicule dans le parc : ajoutez-en un avant de planifier un entretien.
            </Alert>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Véhicule *" htmlFor="vehicleId" error={error("vehicleId")}>
              <select id="vehicleId" name="vehicleId" defaultValue={values.vehicleId} className={selectClass}>
                <option value="">Sélectionner un véhicule</option>
                {vehicles.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name} — {v.licensePlate}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Titre *" htmlFor="title" error={error("title")}>
              <Input id="title" name="title" defaultValue={values.title} required
                placeholder="Vidange + filtres" invalid={Boolean(error("title"))} />
            </Field>

            <Field label="Type" htmlFor="type" error={error("type")}>
              <select id="type" name="type" defaultValue={values.type} className={selectClass}>
                {MAINTENANCE_TYPES.map((t) => (
                  <option key={t} value={t}>{MAINTENANCE_TYPE_LABELS[t]}</option>
                ))}
              </select>
            </Field>

            <Field label="Statut" htmlFor="status" error={error("status")}>
              <select id="status" name="status" defaultValue={values.status} className={selectClass}>
                {MAINTENANCE_STATUSES.map((s) => (
                  <option key={s} value={s}>{MAINTENANCE_STATUS_LABELS[s]}</option>
                ))}
              </select>
            </Field>

            <Field label="Coût (XPF) *" htmlFor="cost" error={error("cost")}>
              <Input id="cost" name="cost" inputMode="numeric" required
                defaultValue={values.cost} invalid={Boolean(error("cost"))} />
            </Field>

            <Field label="Kilométrage" htmlFor="mileage" error={error("mileage")}>
              <Input id="mileage" name="mileage" inputMode="numeric" defaultValue={values.mileage} />
            </Field>

            <Field label="Date d'intervention" htmlFor="performedAt" error={error("performedAt")}>
              <Input id="performedAt" name="performedAt" type="date" defaultValue={values.performedAt} />
            </Field>

            <Field
              label="Prochaine échéance"
              htmlFor="nextDueDate"
              hint="Pour un contrôle technique, met à jour la date du véhicule."
              error={error("nextDueDate")}
            >
              <Input id="nextDueDate" name="nextDueDate" type="date" defaultValue={values.nextDueDate} />
            </Field>

            <Field label="Échéance kilométrique" htmlFor="nextDueMileage" error={error("nextDueMileage")}>
              <Input id="nextDueMileage" name="nextDueMileage" inputMode="numeric"
                defaultValue={values.nextDueMileage} />
            </Field>

            <Field label="Garage" htmlFor="garage" error={error("garage")}>
              <Input id="garage" name="garage" defaultValue={values.garage} placeholder="Garage Teura" />
            </Field>
          </div>

          <div className="mt-4">
            <Field label="Description" htmlFor="description" error={error("description")}>
              <Input id="description" name="description" defaultValue={values.description} />
            </Field>
          </div>

          <div className="mt-5 flex justify-end gap-2 border-t border-line pt-4">
            <Link href="/admin/maintenance" className="text-[13px] text-body hover:text-ink">
              Annuler
            </Link>
            <Submit label={mode === "create" ? "Enregistrer l'intervention" : "Enregistrer"} />
          </div>
        </div>
      </form>

      {mode === "edit" && values.id ? (
        <form action={deleteMaintenanceAction} className="mt-4 flex justify-end">
          <input type="hidden" name="maintenanceId" value={values.id} />
          <Button type="submit" variant="secondary" size="sm">
            <Trash2 className="size-4" aria-hidden />
            Supprimer cette intervention
          </Button>
        </form>
      ) : null}
    </div>
  );
}

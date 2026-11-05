"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/input";
import { addDriverAction, removeDriverAction } from "@/server/actions/customers";
import { IDLE_ACTION_STATE } from "@/server/actions/types";

export type DriverRow = {
  id: number;
  firstName: string;
  lastName: string;
  licenseCardNumber: string | null;
  licenseExpiresAt: string | null;
  isMain: boolean;
};

function Submit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" disabled={pending}>
      {pending ? "Ajout…" : "Ajouter le conducteur"}
    </Button>
  );
}

export function DriverManager({
  customerId,
  drivers,
  canEdit,
}: {
  customerId: number;
  drivers: DriverRow[];
  canEdit: boolean;
}) {
  const [state, formAction] = useActionState(addDriverAction, IDLE_ACTION_STATE);
  const error = (name: string) => state.fieldErrors?.[name]?.[0];

  return (
    <div className="space-y-4">
      <section className="rounded-card border border-line bg-surface">
        <div className="border-b border-line px-5 py-3">
          <h2 className="text-sm font-semibold text-ink">
            {drivers.length} conducteur{drivers.length > 1 ? "s" : ""}
          </h2>
        </div>

        {drivers.length === 0 ? (
          <p className="px-5 py-8 text-center text-xs text-muted">
            Aucun conducteur enregistré pour ce client.
          </p>
        ) : (
          <ul className="divide-y divide-line">
            {drivers.map((driver) => (
              <li key={driver.id} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3">
                <div>
                  <p className="text-[13px] font-semibold text-ink">
                    {driver.firstName} {driver.lastName}
                    {driver.isMain ? (
                      <span className="ml-2 rounded-full bg-brand-soft px-2 py-0.5 text-[10px] font-semibold text-brand-text">
                        Principal
                      </span>
                    ) : null}
                  </p>
                  <p className="text-[11px] text-muted">
                    Permis {driver.licenseCardNumber ?? "—"}
                    {driver.licenseExpiresAt
                      ? ` · expire le ${new Date(driver.licenseExpiresAt).toLocaleDateString("fr-FR", { timeZone: "Pacific/Tahiti" })}`
                      : ""}
                  </p>
                </div>
                {canEdit ? (
                  <form action={removeDriverAction}>
                    <input type="hidden" name="driverId" value={driver.id} />
                    <input type="hidden" name="customerId" value={customerId} />
                    <Button type="submit" variant="secondary" size="sm">
                      <Trash2 className="size-3.5" aria-hidden />
                      Retirer
                    </Button>
                  </form>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      {canEdit ? (
        <section className="rounded-card border border-line bg-surface p-5">
          <h2 className="mb-4 text-sm font-semibold text-ink">Ajouter un conducteur</h2>

          <form action={formAction} className="space-y-4" noValidate>
            <input type="hidden" name="customerId" value={customerId} />

            {state.status !== "idle" ? (
              <Alert variant={state.status === "success" ? "success" : "error"}>
                {state.message ?? "Champs invalides."}
              </Alert>
            ) : null}

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Prénom *" htmlFor="driverFirstName" error={error("firstName")}>
                <Input id="driverFirstName" name="firstName" required />
              </Field>
              <Field label="Nom *" htmlFor="driverLastName" error={error("lastName")}>
                <Input id="driverLastName" name="lastName" required />
              </Field>
              <Field label="Date de naissance" htmlFor="dateOfBirth" error={error("dateOfBirth")}>
                <Input id="dateOfBirth" name="dateOfBirth" type="date" />
              </Field>
              <Field label="N° de permis" htmlFor="licenseCardNumber" error={error("licenseCardNumber")}>
                <Input id="licenseCardNumber" name="licenseCardNumber" />
              </Field>
              <Field label="Permis délivré le" htmlFor="licenseIssuedAt" error={error("licenseIssuedAt")}>
                <Input id="licenseIssuedAt" name="licenseIssuedAt" type="date" />
              </Field>
              <Field label="Permis valable jusqu'au" htmlFor="licenseExpiresAt" error={error("licenseExpiresAt")}>
                <Input id="licenseExpiresAt" name="licenseExpiresAt" type="date" />
              </Field>
            </div>

            <label className="flex items-center gap-2 text-[13px] text-ink">
              <input type="checkbox" name="isMain" className="size-4 accent-[#1D4ED8]" />
              Conducteur principal
            </label>

            <div className="flex justify-end">
              <Submit />
            </div>
          </form>
        </section>
      ) : null}
    </div>
  );
}

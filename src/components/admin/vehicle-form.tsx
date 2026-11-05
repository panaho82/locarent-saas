"use client";

import Link from "next/link";
import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useFormStatus } from "react-dom";
import { ArrowLeft, Info, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/input";
import { cn } from "@/lib/cn";
import { FUEL_LABELS, FUEL_TYPES, SEAT_OPTIONS, TRANSMISSION_LABELS, TRANSMISSIONS } from "@/lib/vehicles";
import {
  createVehicleAction,
  deleteVehicleAction,
  updateVehicleAction,
} from "@/server/actions/vehicles";
import { createCategoryAction } from "@/server/actions/catalog";
import { IDLE_ACTION_STATE } from "@/server/actions/types";

export type VehicleFormValues = {
  id?: number;
  name: string;
  make: string;
  brandId: string;
  model: string;
  licensePlate: string;
  categoryId: string;
  colorSlug: string;
  year: string;
  mileage: string;
  seats: string;
  fuelType: string;
  transmissionType: string;
  nextTechnicalControlDate: string;
  mainLocationId: string;
  dailyRate: string;
  weeklyRate: string;
  monthlyRate: string;
  baseKilometers: string;
  extraKmPrice: string;
  isUnlimitedKilometers: boolean;
};

export type VehicleFormOptions = {
  brands: { id: number; name: string }[];
  categories: { id: number; name: string }[];
  colors: { slug: string; name: string }[];
  locations: { id: number; name: string }[];
};

function Submit({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Enregistrement…" : label}
    </Button>
  );
}

const FIELD_LABELS: Record<string, string> = {
  name: "Nom",
  model: "Modèle",
  brandId: "Marque",
  licensePlate: "Immatriculation",
  mainLocationId: "Emplacement principal",
  categoryId: "Catégorie",
  colorSlug: "Couleur",
  year: "Année",
  fuelType: "Carburant",
  transmissionType: "Transmission",
  mileage: "Kilométrage",
  seats: "Nombre de places",
  nextTechnicalControlDate: "Contrôle technique",
  dailyRate: "Prix par jour",
  weeklyRate: "Prix par semaine",
  monthlyRate: "Prix par mois",
  baseKilometers: "Kilomètres inclus",
  extraKmPrice: "Prix du km supplémentaire",
};

const selectClass =
  "h-10 w-full rounded-btn border border-line bg-surface px-3 text-sm text-ink";

/** Ligne de formulaire : titre + description à gauche, champs à droite. */
function Row({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid gap-4 border-t border-line py-6 first:border-t-0 sm:grid-cols-3">
      <div>
        <p className="text-sm font-semibold text-ink">{title}</p>
        {description ? (
          <p className="mt-1 text-[13px] text-body">{description}</p>
        ) : null}
      </div>
      <div className="sm:col-span-2">{children}</div>
    </div>
  );
}

export function VehicleForm({
  mode,
  values,
  options,
}: {
  mode: "create" | "edit";
  values: VehicleFormValues;
  options: VehicleFormOptions;
}) {
  const action = mode === "create" ? createVehicleAction : updateVehicleAction;
  const [state, formAction] = useActionState(action, IDLE_ACTION_STATE);
  const [categoryState, categoryAction] = useActionState(
    createCategoryAction,
    IDLE_ACTION_STATE,
  );
  const router = useRouter();

  // Après création d'une catégorie, on recharge les options du formulaire.
  // `router.refresh()` n'est pas un setState : il ne déclenche pas de rendu en
  // cascade, il redemande les données au serveur.
  useEffect(() => {
    if (categoryState.status === "success") router.refresh();
  }, [categoryState, router]);
  const [tab, setTab] = useState<"informations" | "tarification">("informations");

  const error = (name: string) => state.fieldErrors?.[name]?.[0];

  /* Erreurs : on nomme les champs concernés plutôt que de basculer
     d'onglet de force — un setState dans un effet est proscrit par
     react-hooks/set-state-in-effect, et une bascule forcée empêcherait
     l'utilisateur de consulter l'autre onglet. */
  const invalidFields = Object.entries(state.fieldErrors ?? {}).map(
    ([key, messages]) => FIELD_LABELS[key] ?? messages[0] ?? key,
  );

  return (
    <div>
      <Link
        href="/admin/cars"
        className="mb-4 inline-flex items-center gap-1.5 text-[13px] text-body hover:text-ink"
      >
        <ArrowLeft className="size-3.5" aria-hidden />
        Retour
      </Link>

      <form action={formAction} noValidate>
        {values.id ? <input type="hidden" name="vehicleId" value={values.id} /> : null}

        <div className="rounded-card border border-line bg-surface">
          {/* Onglets — même vocabulaire visuel que la maquette d'origine. */}
          <div className="flex gap-2 border-b border-line px-5 pt-4">
            {(
              [
                ["informations", "Informations"],
                ["tarification", "Tarification"],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setTab(key)}
                aria-current={tab === key ? "page" : undefined}
                className={cn(
                  "-mb-px rounded-t-btn border border-b-0 px-3 py-2 text-[13px] font-medium transition-colors",
                  tab === key
                    ? "border-line bg-surface text-ink"
                    : "border-transparent text-body hover:text-ink",
                )}
              >
                {label}
              </button>
            ))}
            <span className="rounded-t-btn px-3 py-2 text-[13px] text-muted">
              Documents
            </span>
          </div>

          <div className="px-5 pb-5">
            {state.status !== "idle" ? (
              <div className="pt-4">
                <Alert variant={state.status === "success" ? "success" : "error"}>
                  {state.message ??
                    (state.status === "error"
                      ? invalidFields.length > 0
                        ? `Champs à corriger : ${[...new Set(invalidFields)].join(", ")}.`
                        : "Certains champs sont invalides ou incomplets."
                      : "")}
                </Alert>
              </div>
            ) : null}

            {/* Bandeau de section, comme sur la capture « Ajouter un véhicule ». */}
            <div className="my-4 flex items-center gap-2 rounded-btn bg-[#EAF1FB] px-4 py-3">
              <Info className="size-4 text-[#1E40AF]" aria-hidden />
              <span className="text-sm font-semibold text-ink">
                {tab === "informations" ? "Informations de base" : "Tarification"}
              </span>
            </div>

            {/* Les deux panneaux restent montés : changer d'onglet ne doit pas
                perdre les valeurs saisies (un démontage les effacerait). */}
            <div className={tab === "informations" ? undefined : "hidden"}>
              <>
                <Row title="Informations véhicule" description="Ajouter les informations du véhicule">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Nom *" htmlFor="name" error={error("name")}>
                      <Input id="name" name="name" defaultValue={values.name} required
                        placeholder="Saisir le nom du véhicule" invalid={Boolean(error("name"))} />
                    </Field>
                    <Field label="Modèle *" htmlFor="model" error={error("model")}>
                      <Input id="model" name="model" defaultValue={values.model}
                        placeholder="Saisir le modèle" />
                    </Field>
                    <Field label="Marque *" htmlFor="brandId" error={error("brandId")}>
                      <select id="brandId" name="brandId" defaultValue={values.brandId} className={selectClass}>
                        <option value="">Rechercher une marque</option>
                        {options.brands.map((b) => (
                          <option key={b.id} value={b.id}>{b.name}</option>
                        ))}
                      </select>
                    </Field>
                    <Field label="Immatriculation *" htmlFor="licensePlate" error={error("licensePlate")}>
                      <Input id="licensePlate" name="licensePlate" defaultValue={values.licensePlate}
                        required placeholder="Saisir l'immatriculation"
                        invalid={Boolean(error("licensePlate"))} />
                    </Field>
                    <Field label="Emplacement principal *" htmlFor="mainLocationId" error={error("mainLocationId")}>
                      <select id="mainLocationId" name="mainLocationId" defaultValue={values.mainLocationId}
                        className={selectClass}>
                        <option value="">Sélectionner un lieu</option>
                        {options.locations.map((l) => (
                          <option key={l.id} value={l.id}>{l.name}</option>
                        ))}
                      </select>
                    </Field>
                  </div>
                  {options.locations.length === 0 ? (
                    <p className="mt-2 text-xs text-muted">
                      Aucun lieu enregistré : créez-en un dans « Lieux » pour pouvoir affecter le véhicule.
                    </p>
                  ) : null}
                </Row>

                <Row
                  title="Informations supplémentaires"
                  description="Détails optionnels du véhicule (Facultatif)"
                >
                  <div className="grid gap-4 sm:grid-cols-3">
                    <Field label="Catégorie" htmlFor="categoryId" error={error("categoryId")}>
                      <select id="categoryId" name="categoryId" defaultValue={values.categoryId} className={selectClass}>
                        <option value="">Sélectionner</option>
                        {options.categories.map((c) => (
                          <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                      </select>
                      <details className="mt-1.5">
                        <summary className="cursor-pointer text-[12px] font-medium text-brand-text">
                          Nouvelle catégorie
                        </summary>
                        <div className="mt-2 flex gap-2">
                          <input
                            name="categoryName"
                            formAction={categoryAction}
                            placeholder="Scooter, Utilitaire…"
                            className="h-9 w-full rounded-btn border border-line bg-surface px-2 text-[13px] text-ink"
                          />
                          <Button
                            type="submit"
                            formAction={categoryAction}
                            variant="secondary"
                            size="sm"
                          >
                            Créer
                          </Button>
                        </div>
                        {categoryState.message ? (
                          <p
                            className={
                              categoryState.status === "success"
                                ? "mt-1 text-[11px] text-success"
                                : "mt-1 text-[11px] text-danger"
                            }
                          >
                            {categoryState.message}
                          </p>
                        ) : null}
                      </details>
                    </Field>
                    <Field label="Couleur" htmlFor="colorSlug" error={error("colorSlug")}>
                      <select id="colorSlug" name="colorSlug" defaultValue={values.colorSlug} className={selectClass}>
                        <option value="">Sélectionner</option>
                        {options.colors.map((c) => (
                          <option key={c.slug} value={c.slug}>{c.name}</option>
                        ))}
                      </select>
                    </Field>
                    <Field label="Année du véhicule" htmlFor="year" error={error("year")}>
                      <Input id="year" name="year" inputMode="numeric" defaultValue={values.year}
                        placeholder="Saisir l'année" invalid={Boolean(error("year"))} />
                    </Field>
                    <Field label="Carburant" htmlFor="fuelType" error={error("fuelType")}>
                      <select id="fuelType" name="fuelType" defaultValue={values.fuelType} className={selectClass}>
                        <option value="">Sélectionner</option>
                        {FUEL_TYPES.map((f) => (
                          <option key={f} value={f}>{FUEL_LABELS[f]}</option>
                        ))}
                      </select>
                    </Field>
                    <Field label="Transmission" htmlFor="transmissionType" error={error("transmissionType")}>
                      <select id="transmissionType" name="transmissionType" defaultValue={values.transmissionType}
                        className={selectClass}>
                        <option value="">Sélectionner</option>
                        {TRANSMISSIONS.map((t) => (
                          <option key={t} value={t}>{TRANSMISSION_LABELS[t]}</option>
                        ))}
                      </select>
                    </Field>
                    <Field label="Kilométrage" htmlFor="mileage" error={error("mileage")}>
                      <Input id="mileage" name="mileage" inputMode="numeric" defaultValue={values.mileage}
                        placeholder="Saisir le kilométrage" invalid={Boolean(error("mileage"))} />
                    </Field>
                    <Field label="Prochain contrôle technique (DTT)" htmlFor="nextTechnicalControlDate"
                      error={error("nextTechnicalControlDate")}>
                      <Input id="nextTechnicalControlDate" name="nextTechnicalControlDate" type="date"
                        defaultValue={values.nextTechnicalControlDate} />
                    </Field>
                    <Field label="Nombre de places" htmlFor="seats" error={error("seats")}>
                      <select id="seats" name="seats" defaultValue={values.seats} className={selectClass}>
                        <option value="">Sélectionner</option>
                        {SEAT_OPTIONS.map((s) => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                      </select>
                    </Field>
                  </div>
                </Row>
              </>
            </div>
            <div className={tab === "tarification" ? undefined : "hidden"}>
              <Row title="Tarifs" description="Montants en francs pacifiques (XPF)">
                <div className="grid gap-4 sm:grid-cols-3">
                  <Field label="Prix par jour *" htmlFor="dailyRate" error={error("dailyRate")}>
                    <Input id="dailyRate" name="dailyRate" inputMode="numeric" required
                      defaultValue={values.dailyRate} placeholder="0"
                      invalid={Boolean(error("dailyRate"))} />
                  </Field>
                  <Field label="Prix par semaine" htmlFor="weeklyRate" error={error("weeklyRate")}>
                    <Input id="weeklyRate" name="weeklyRate" inputMode="numeric" defaultValue={values.weeklyRate} />
                  </Field>
                  <Field label="Prix par mois" htmlFor="monthlyRate" error={error("monthlyRate")}>
                    <Input id="monthlyRate" name="monthlyRate" inputMode="numeric" defaultValue={values.monthlyRate} />
                  </Field>
                </div>

                <label className="mt-4 flex items-center gap-2 text-[13px] text-ink">
                  <input type="checkbox" name="isUnlimitedKilometers" defaultChecked={values.isUnlimitedKilometers}
                    className="size-4 accent-[#1D4ED8]" />
                  Kilométrage illimité
                </label>

                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <Field label="Kilomètres inclus" htmlFor="baseKilometers" error={error("baseKilometers")}>
                    <Input id="baseKilometers" name="baseKilometers" inputMode="numeric"
                      defaultValue={values.baseKilometers} />
                  </Field>
                  <Field label="Prix du km supplémentaire" htmlFor="extraKmPrice" error={error("extraKmPrice")}>
                    <Input id="extraKmPrice" name="extraKmPrice" inputMode="numeric"
                      defaultValue={values.extraKmPrice} />
                  </Field>
                </div>
              </Row>
            </div>

            <div className="flex flex-wrap items-center justify-end gap-2 border-t border-line pt-4">
              <Link href="/admin/cars" className="text-[13px] text-body hover:text-ink">
                Annuler
              </Link>
              {tab === "informations" ? (
                <Button type="button" variant="secondary" onClick={() => setTab("tarification")}>
                  Ajouter la tarification ›
                </Button>
              ) : null}
              <Submit label={mode === "create" ? "Ajouter le véhicule" : "Enregistrer"} />
            </div>
          </div>
        </div>
      </form>

      {mode === "edit" && values.id ? (
        <form action={deleteVehicleAction} className="mt-4 flex justify-end">
          <input type="hidden" name="vehicleId" value={values.id} />
          <Button type="submit" variant="secondary" size="sm">
            <Trash2 className="size-4" aria-hidden />
            Supprimer le véhicule
          </Button>
        </form>
      ) : null}
    </div>
  );
}

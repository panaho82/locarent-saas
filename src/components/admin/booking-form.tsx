"use client";

import Link from "next/link";
import { useActionState, useMemo, useState } from "react";
import { useFormStatus } from "react-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/input";
import {
  computePrice,
  computeRentalDays,
  suggestBilling,
  type RateCard,
} from "@/lib/pricing";
import { formatXPF } from "@/lib/format";
import { createBookingAction } from "@/server/actions/bookings";
import { IDLE_ACTION_STATE } from "@/server/actions/types";

export type BookingFormOptions = {
  customers: { id: number; name: string }[];
  vehicles: {
    id: number;
    name: string;
    licensePlate: string;
    dailyRate: number;
    weeklyRate: number | null;
    monthlyRate: number | null;
  }[];
  locations: { id: number; name: string; price: number | null; isFree: boolean }[];
  extras: { id: number; name: string; price: number; priceType: "per_day" | "per_rental" }[];
  tvaEnabled: boolean;
  taxRate: number;
  toleranceHours: number;
};

const selectClass =
  "h-10 w-full rounded-btn border border-line bg-surface px-3 text-sm text-ink";

const FIELD_LABELS: Record<string, string> = {
  customerId: "Client",
  vehicleId: "Véhicule",
  startDate: "Date de départ",
  startTime: "Heure de départ",
  endDate: "Date de retour",
  endTime: "Heure de retour",
  unit: "Unité de facturation",
  value: "Durée facturée",
  discountValue: "Remise",
};

function Submit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Enregistrement…" : "Enregistrer la réservation"}
    </Button>
  );
}

export function BookingForm({ options }: { options: BookingFormOptions }) {
  const [state, formAction] = useActionState(createBookingAction, IDLE_ACTION_STATE);

  const today = new Date().toISOString().slice(0, 10);
  const [customerId, setCustomerId] = useState("");
  const [vehicleId, setVehicleId] = useState("");
  const [startDate, setStartDate] = useState(today);
  const [startTime, setStartTime] = useState("08:00");
  const [endDate, setEndDate] = useState(today);
  const [endTime, setEndTime] = useState("18:00");
  const [pickupId, setPickupId] = useState("");
  const [dropoffId, setDropoffId] = useState("");
  const [unit, setUnit] = useState<"days" | "weeks" | "months">("days");
  const [value, setValue] = useState("1");
  const [selectedExtras, setSelectedExtras] = useState<number[]>([]);
  const [discountType, setDiscountType] = useState<"amount" | "percent">("amount");
  const [discountValue, setDiscountValue] = useState("");
  const [unlimited, setUnlimited] = useState(true);

  const vehicle = options.vehicles.find((v) => String(v.id) === vehicleId);
  const error = (name: string) => state.fieldErrors?.[name]?.[0];
  const invalid = [...new Set(Object.keys(state.fieldErrors ?? {}).map((k) => FIELD_LABELS[k] ?? k))];

  /** Le moteur de prix est pur : on l'exécute aussi dans le navigateur pour
   *  afficher un récapitulatif en direct. Le serveur recalcule de toute façon. */
  const preview = useMemo(() => {
    if (!vehicle) return null;
    try {
      const days = computeRentalDays(startDate, startTime, endDate, endTime, options.toleranceHours);
      const rates: RateCard = {
        daily: vehicle.dailyRate,
        weekly: vehicle.weeklyRate,
        monthly: vehicle.monthlyRate,
      };
      const suggestion = suggestBilling(days, rates);
      const billingUnit = unit === suggestion.unit && Number(value) === suggestion.value
        ? unit
        : unit;
      const billingValue = Number(value) || suggestion.value;

      const pickup = options.locations.find((l) => String(l.id) === pickupId);
      const dropoff = options.locations.find((l) => String(l.id) === dropoffId);

      const price = computePrice({
        startDate,
        startTime,
        endDate,
        endTime,
        toleranceHours: options.toleranceHours,
        unit: billingUnit,
        value: billingValue,
        rates,
        extras: options.extras
          .filter((e) => selectedExtras.includes(e.id))
          .map((e) => ({
            name: e.name,
            unitPrice: e.price,
            priceType: e.priceType,
            qty: 1,
          })),
        pickupFee: pickup && !pickup.isFree ? (pickup.price ?? 0) : 0,
        dropoffFee:
          dropoff && !dropoff.isFree && dropoffId !== pickupId ? (dropoff.price ?? 0) : 0,
        discounts:
          Number(discountValue) > 0
            ? [{ type: discountType, value: Number(discountValue) }]
            : [],
        tvaEnabled: options.tvaEnabled,
        taxRate: options.taxRate,
      });

      return { days, suggestion, price };
    } catch {
      return null;
    }
  }, [
    vehicle, startDate, startTime, endDate, endTime, unit, value,
    pickupId, dropoffId, selectedExtras, discountType, discountValue, options,
  ]);

  /** Aligne l'unité et la valeur sur la suggestion quand les dates changent. */
  const applySuggestion = () => {
    if (!preview) return;
    setUnit(preview.suggestion.unit);
    setValue(String(preview.suggestion.value));
  };

  return (
    <div>
      <Link
        href="/admin/reservations"
        className="mb-4 inline-flex items-center gap-1.5 text-[13px] text-body hover:text-ink"
      >
        <ArrowLeft className="size-3.5" aria-hidden />
        Retour
      </Link>

      <div className="grid gap-4 lg:grid-cols-3">
        <form action={formAction} noValidate className="lg:col-span-2">
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
              <Field label="Client *" htmlFor="customerId" error={error("customerId")}>
                <select
                  id="customerId"
                  name="customerId"
                  value={customerId}
                  onChange={(e) => setCustomerId(e.target.value)}
                  className={selectClass}
                >
                  <option value="">Sélectionner un client</option>
                  {options.customers.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </Field>

              <Field label="Véhicule *" htmlFor="vehicleId" error={error("vehicleId")}>
                <select
                  id="vehicleId"
                  name="vehicleId"
                  value={vehicleId}
                  onChange={(e) => setVehicleId(e.target.value)}
                  className={selectClass}
                >
                  <option value="">Sélectionner un véhicule</option>
                  {options.vehicles.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.name} — {v.licensePlate} ({v.dailyRate} / jour)
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Départ *" htmlFor="startDate" error={error("startDate")}>
                <div className="flex gap-2">
                  <Input id="startDate" name="startDate" type="date" value={startDate}
                    onChange={(e) => setStartDate(e.target.value)} />
                  <Input name="startTime" type="time" value={startTime}
                    onChange={(e) => setStartTime(e.target.value)} className="w-28" />
                </div>
              </Field>

              <Field label="Retour *" htmlFor="endDate" error={error("endDate")}>
                <div className="flex gap-2">
                  <Input id="endDate" name="endDate" type="date" value={endDate}
                    onChange={(e) => setEndDate(e.target.value)} />
                  <Input name="endTime" type="time" value={endTime}
                    onChange={(e) => setEndTime(e.target.value)} className="w-28" />
                </div>
              </Field>

              <Field label="Lieu de prise en charge" htmlFor="pickupLocationId">
                <select id="pickupLocationId" name="pickupLocationId" value={pickupId}
                  onChange={(e) => setPickupId(e.target.value)} className={selectClass}>
                  <option value="">Aucun</option>
                  {options.locations.map((l) => (
                    <option key={l.id} value={l.id}>{l.name}</option>
                  ))}
                </select>
              </Field>

              <Field label="Lieu de restitution" htmlFor="dropoffLocationId">
                <select id="dropoffLocationId" name="dropoffLocationId" value={dropoffId}
                  onChange={(e) => setDropoffId(e.target.value)} className={selectClass}>
                  <option value="">Identique au départ</option>
                  {options.locations.map((l) => (
                    <option key={l.id} value={l.id}>{l.name}</option>
                  ))}
                </select>
              </Field>

              <Field label="Unité de facturation" htmlFor="unit" error={error("unit")}>
                <select id="unit" name="unit" value={unit}
                  onChange={(e) => setUnit(e.target.value as typeof unit)} className={selectClass}>
                  <option value="days">Jours</option>
                  <option value="weeks">Semaines</option>
                  <option value="months">Mois</option>
                </select>
              </Field>

              <Field
                label="Durée facturée"
                htmlFor="value"
                hint={preview ? `Suggestion : ${preview.suggestion.value} ${preview.suggestion.unit}` : undefined}
                error={error("value")}
              >
                <div className="flex gap-2">
                  <Input id="value" name="value" inputMode="numeric" value={value}
                    onChange={(e) => setValue(e.target.value)} />
                  <Button type="button" variant="secondary" onClick={applySuggestion}>
                    Suggérer
                  </Button>
                </div>
              </Field>
            </div>

            {options.extras.length > 0 ? (
              <fieldset className="mt-4 border-t border-line pt-4">
                <legend className="mb-2 text-[13px] font-medium text-ink">Options</legend>
                <div className="grid gap-1 sm:grid-cols-2">
                  {options.extras.map((extra) => (
                    <label key={extra.id} className="flex items-center gap-2 text-[13px] text-body">
                      <input
                        type="checkbox"
                        name="extras"
                        value={extra.id}
                        checked={selectedExtras.includes(extra.id)}
                        onChange={(e) =>
                          setSelectedExtras((current) =>
                            e.target.checked
                              ? [...current, extra.id]
                              : current.filter((id) => id !== extra.id),
                          )
                        }
                        className="size-4 accent-[#1D4ED8]"
                      />
                      {extra.name} — {formatXPF(extra.price)}
                      {extra.priceType === "per_day" ? " / jour" : " / location"}
                    </label>
                  ))}
                </div>
              </fieldset>
            ) : null}

            <div className="mt-4 grid gap-4 border-t border-line pt-4 sm:grid-cols-3">
              <Field label="Remise" htmlFor="discountValue" error={error("discountValue")}>
                <Input id="discountValue" name="discountValue" inputMode="numeric"
                  value={discountValue} onChange={(e) => setDiscountValue(e.target.value)}
                  placeholder="0" />
              </Field>
              <Field label="Type de remise" htmlFor="discountType">
                <select id="discountType" name="discountType" value={discountType}
                  onChange={(e) => setDiscountType(e.target.value as "amount" | "percent")}
                  className={selectClass}>
                  <option value="amount">Montant (XPF)</option>
                  <option value="percent">Pourcentage</option>
                </select>
              </Field>
              <Field label="Libellé de la remise" htmlFor="discountLabel">
                <Input id="discountLabel" name="discountLabel" placeholder="Geste commercial" />
              </Field>
            </div>

            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <Field label="Notes client" htmlFor="notes">
                <Input id="notes" name="notes" />
              </Field>
              <Field label="Notes internes" htmlFor="internalNotes">
                <Input id="internalNotes" name="internalNotes" />
              </Field>
            </div>

            <div className="mt-4 space-y-2 border-t border-line pt-4">
              <label className="flex items-center gap-2 text-[13px] text-ink">
                <input type="checkbox" name="isUnlimitedKilometers" checked={unlimited}
                  onChange={(e) => setUnlimited(e.target.checked)}
                  className="size-4 accent-[#1D4ED8]" />
                Kilométrage illimité
              </label>
              <label className="flex items-center gap-2 text-[13px] text-ink">
                <input type="checkbox" name="confirmImmediately" defaultChecked
                  className="size-4 accent-[#1D4ED8]" />
                Confirmer immédiatement
              </label>
            </div>

            <div className="mt-5 flex justify-end gap-2 border-t border-line pt-4">
              <Link href="/admin/reservations" className="text-[13px] text-body hover:text-ink">
                Annuler
              </Link>
              <Submit />
            </div>
          </div>
        </form>

        <aside className="lg:col-span-1">
          <div className="sticky top-4 rounded-card border border-line bg-surface p-5">
            <h2 className="mb-3 text-sm font-semibold text-ink">Récapitulatif</h2>

            {preview ? (
              <>
                <p className="mb-3 text-[12px] text-muted">
                  {preview.days} jour{preview.days > 1 ? "s" : ""} de location
                </p>
                <ul className="space-y-1.5">
                  {preview.price.lines.map((line, index) => (
                    <li key={index} className="flex justify-between gap-2 text-[13px]">
                      <span className="text-body">{line.label}</span>
                      <span className={line.amount < 0 ? "text-success" : "text-ink"}>
                        {formatXPF(line.amount)}
                      </span>
                    </li>
                  ))}
                </ul>
                <div className="mt-3 space-y-1 border-t border-line pt-3 text-[13px]">
                  <div className="flex justify-between">
                    <span className="text-body">Total HT</span>
                    <span className="font-medium text-ink">{formatXPF(preview.price.totalPrice)}</span>
                  </div>
                  {preview.price.taxRate > 0 ? (
                    <div className="flex justify-between">
                      <span className="text-body">TVA {preview.price.taxRate} %</span>
                      <span className="text-ink">{formatXPF(preview.price.taxAmount)}</span>
                    </div>
                  ) : null}
                  <div className="flex justify-between border-t border-line pt-2">
                    <span className="font-semibold text-ink">Total TTC</span>
                    <span className="text-lg font-bold text-ink">
                      {formatXPF(preview.price.totalWithTax)}
                    </span>
                  </div>
                </div>
              </>
            ) : (
              <p className="text-[13px] text-muted">
                Choisissez un véhicule et des dates pour voir le prix.
              </p>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}

/**
 * Moteur de prix d'une location.
 *
 * Module **pur** : aucune dépendance à la base ni à React, donc testable
 * exhaustivement. C'est volontaire — c'est ici que les erreurs coûtent de
 * l'argent (spec 06-flux.md, section C).
 *
 * Règles :
 *  · devise XPF, montants **entiers**, jamais de float (arrondi au franc) ;
 *  · Tahiti est à UTC−10 toute l'année, sans heure d'été : la conversion
 *    date+heure → instant est donc exacte et sans table de fuseaux ;
 *  · les tarifs sont **figés** sur la réservation au moment de sa création :
 *    si l'agence change ses prix demain, l'historique ne bouge pas.
 */

export type BillingUnit = "days" | "weeks" | "months";

/** Décalage fixe de la Polynésie française (UTC−10). */
const TAHITI_OFFSET_HOURS = -10;
const HOUR_MS = 3_600_000;

export type RateCard = {
  daily: number;
  weekly: number | null;
  monthly: number | null;
};

export type PriceExtra = {
  name: string;
  unitPrice: number;
  priceType: "per_day" | "per_rental";
  qty: number;
};

export type PriceDiscount = {
  label?: string | null;
  type: "amount" | "percent";
  value: number;
};

export type PriceInput = {
  startDate: string;
  startTime: string;
  endDate: string;
  endTime: string;
  /** tolérance en heures avant de facturer un jour de plus */
  toleranceHours?: number;
  unit: BillingUnit;
  /** durée exprimée dans l'unité choisie */
  value: number;
  rates: RateCard;
  extras?: PriceExtra[];
  pickupFee?: number;
  dropoffFee?: number;
  discounts?: PriceDiscount[];
  /** taux en pourcentage ; ignoré si `tvaEnabled` est faux */
  taxRate?: number;
  tvaEnabled?: boolean;
};

export type PriceLine = {
  label: string;
  amount: number;
};

export type PriceResult = {
  rentalDays: number;
  unit: BillingUnit;
  value: number;
  unitRate: number;
  vehicleTotal: number;
  extrasTotal: number;
  locationsTotal: number;
  discountsTotal: number;
  totalPrice: number;
  taxRate: number;
  taxAmount: number;
  totalWithTax: number;
  lines: PriceLine[];
};

/** Entier, positif ou nul. */
function money(value: number): number {
  return Math.max(0, Math.round(value));
}

/**
 * Convertit une date et une heure locales de Tahiti en instant UTC.
 * `2026-10-21` + `08:00` → 21/10/2026 18:00 UTC.
 */
export function toTahitiInstant(date: string, time: string): number {
  const [year, month, day] = date.split("-").map(Number);
  const [hour, minute] = time.split(":").map(Number);

  if (
    !Number.isFinite(year) ||
    !Number.isFinite(month) ||
    !Number.isFinite(day) ||
    !Number.isFinite(hour) ||
    !Number.isFinite(minute)
  ) {
    throw new RangeError(`Date ou heure invalide : ${date} ${time}`);
  }

  // Date.UTC interprète les composantes comme UTC ; l'heure locale de Tahiti
  // vaut UTC−10, donc l'instant UTC est l'heure locale + 10 h.
  return Date.UTC(year, month - 1, day, hour, minute) - TAHITI_OFFSET_HOURS * HOUR_MS;
}

/**
 * Nombre de jours facturés.
 *
 * `toleranceHours` vient des réglages de l'agence : un retour en retard de
 * moins de N heures ne déclenche pas un jour supplémentaire.
 */
export function computeRentalDays(
  startDate: string,
  startTime: string,
  endDate: string,
  endTime: string,
  toleranceHours = 0,
): number {
  const start = toTahitiInstant(startDate, startTime);
  const end = toTahitiInstant(endDate, endTime);

  if (end <= start) {
    throw new RangeError("La date de retour doit être postérieure au départ.");
  }

  const totalHours = (end - start) / HOUR_MS;
  // `totalHours` est en heures : diviser par 24, pas par DAY_MS (millisecondes).
  const fullDays = Math.floor(totalHours / 24);
  const remainder = totalHours - fullDays * 24;

  return Math.max(1, fullDays + (remainder > toleranceHours ? 1 : 0));
}

/** Taux applicable pour une unité donnée, avec repli sur un multiple du jour. */
export function rateForUnit(rates: RateCard, unit: BillingUnit): number {
  if (unit === "weeks") return rates.weekly ?? rates.daily * 7;
  if (unit === "months") return rates.monthly ?? rates.daily * 30;
  return rates.daily;
}

/**
 * Unité de facturation suggérée pour une durée.
 *
 * La spec propose des seuils (≤ 6 jours, 7 jours à 3 semaines, au-delà).
 * On les applique, mais on ne suggère jamais une formule **plus chère** que
 * le tarif journalier : mieux vaut une suggestion un peu généreuse qu'une
 * facture surprise. L'agent reste libre de changer l'unité.
 */
export function suggestBilling(
  rentalDays: number,
  rates: RateCard,
): { unit: BillingUnit; value: number; total: number } {
  const candidates: { unit: BillingUnit; value: number; total: number }[] = [
    { unit: "days", value: rentalDays, total: rentalDays * rates.daily },
  ];

  if (rentalDays >= 7) {
    const weeks = Math.floor(rentalDays / 7);
    const rate = rateForUnit(rates, "weeks");
    candidates.push({ unit: "weeks", value: weeks, total: weeks * rate });
    const ceilWeeks = Math.ceil(rentalDays / 7);
    if (ceilWeeks !== weeks) {
      candidates.push({ unit: "weeks", value: ceilWeeks, total: ceilWeeks * rate });
    }
  }

  if (rentalDays >= 30) {
    const months = Math.floor(rentalDays / 30);
    const rate = rateForUnit(rates, "months");
    candidates.push({ unit: "months", value: months, total: months * rate });
    const ceilMonths = Math.ceil(rentalDays / 30);
    if (ceilMonths !== months) {
      candidates.push({ unit: "months", value: ceilMonths, total: ceilMonths * rate });
    }
  }

  // Le moins cher ; à prix égal, l'unité la plus simple (jours d'abord).
  const order: Record<BillingUnit, number> = { days: 0, weeks: 1, months: 2 };
  candidates.sort((a, b) => a.total - b.total || order[a.unit] - order[b.unit]);
  return candidates[0];
}

/**
 * Prix complet d'une réservation.
 *
 * Les remises s'appliquent **dans l'ordre** sur le sous-total (véhicule +
 * options + frais de lieux) ; une remise ne peut pas rendre le total négatif.
 */
export function computePrice(input: PriceInput): PriceResult {
  const rentalDays = computeRentalDays(
    input.startDate,
    input.startTime,
    input.endDate,
    input.endTime,
    input.toleranceHours ?? 0,
  );

  if (!Number.isFinite(input.value) || input.value <= 0) {
    throw new RangeError("La durée facturée doit être strictement positive.");
  }

  const unitRate = rateForUnit(input.rates, input.unit);
  const vehicleTotal = money(input.value * unitRate);

  const extras = input.extras ?? [];
  const extrasTotal = money(
    extras.reduce(
      (sum, extra) =>
        sum + extra.qty * extra.unitPrice * (extra.priceType === "per_day" ? rentalDays : 1),
      0,
    ),
  );

  const locationsTotal = money((input.pickupFee ?? 0) + (input.dropoffFee ?? 0));

  const subtotal = vehicleTotal + extrasTotal + locationsTotal;

  let running = subtotal;
  let discountsTotal = 0;
  for (const discount of input.discounts ?? []) {
    const raw =
      discount.type === "percent" ? (running * discount.value) / 100 : discount.value;
    const amount = Math.min(running, money(raw));
    running -= amount;
    discountsTotal += amount;
  }

  const totalPrice = money(subtotal - discountsTotal);
  const taxRate = input.tvaEnabled ? (input.taxRate ?? 0) : 0;
  const taxAmount = money((totalPrice * taxRate) / 100);

  const lines: PriceLine[] = [
    {
      label: `Location ${input.value} ${unitLabel(input.unit, input.value)}`,
      amount: vehicleTotal,
    },
  ];

  for (const extra of extras) {
    lines.push({
      label:
        extra.priceType === "per_day"
          ? `${extra.name} (${extra.qty} × ${rentalDays} j)`
          : `${extra.name} (${extra.qty})`,
      amount: money(
        extra.qty * extra.unitPrice * (extra.priceType === "per_day" ? rentalDays : 1),
      ),
    });
  }

  if ((input.pickupFee ?? 0) > 0) {
    lines.push({ label: "Frais de prise en charge", amount: money(input.pickupFee ?? 0) });
  }
  if ((input.dropoffFee ?? 0) > 0) {
    lines.push({ label: "Frais de restitution", amount: money(input.dropoffFee ?? 0) });
  }
  for (const discount of input.discounts ?? []) {
    const amount = money(
      discount.type === "percent" ? (subtotal * discount.value) / 100 : discount.value,
    );
    lines.push({
      label: discount.label || (discount.type === "percent" ? `Remise ${discount.value} %` : "Remise"),
      amount: -amount,
    });
  }

  return {
    rentalDays,
    unit: input.unit,
    value: input.value,
    unitRate,
    vehicleTotal,
    extrasTotal,
    locationsTotal,
    discountsTotal,
    totalPrice,
    taxRate,
    taxAmount,
    totalWithTax: totalPrice + taxAmount,
    lines,
  };
}

export function unitLabel(unit: BillingUnit, value: number): string {
  if (unit === "weeks") return value > 1 ? "semaines" : "semaine";
  if (unit === "months") return value > 1 ? "mois" : "mois";
  return value > 1 ? "jours" : "jour";
}

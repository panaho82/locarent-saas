/**
 * Formatage — les règles du contexte polynésien sont ici, une seule fois.
 *
 *   · montants en francs pacifiques (XPF), sans décimale ;
 *   · dates en Pacific/Tahiti (UTC-10), jamais dans le fuseau du serveur.
 */

export const TIMEZONE = "Pacific/Tahiti";
export const CURRENCY = "XPF";

const integerFormatter = new Intl.NumberFormat("fr-FR", {
  maximumFractionDigits: 0,
});

const dateFormatter = new Intl.DateTimeFormat("fr-FR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  timeZone: TIMEZONE,
});

const longDateFormatter = new Intl.DateTimeFormat("fr-FR", {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: TIMEZONE,
});

const dateTimeFormatter = new Intl.DateTimeFormat("fr-FR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: TIMEZONE,
});

const monthFormatter = new Intl.DateTimeFormat("fr-FR", {
  month: "long",
  year: "numeric",
  timeZone: TIMEZONE,
});

/** 6630 → « 6 630 XPF » */
export function formatXPF(amount: number | null | undefined): string {
  if (amount === null || amount === undefined || Number.isNaN(amount)) {
    return "—";
  }
  return `${integerFormatter.format(Math.round(amount))} ${CURRENCY}`;
}

/** 01/11/2026 */
export function formatDate(value: Date | string | null | undefined): string {
  const date = toDate(value);
  return date ? dateFormatter.format(date) : "—";
}

/** dimanche 1er novembre 2026 */
export function formatLongDate(
  value: Date | string | null | undefined,
): string {
  const date = toDate(value);
  return date ? longDateFormatter.format(date) : "—";
}

/** 01/11/2026 08:00 (heure de Tahiti) */
export function formatDateTime(
  value: Date | string | null | undefined,
): string {
  const date = toDate(value);
  return date ? dateTimeFormatter.format(date) : "—";
}

/** novembre 2026 */
export function formatMonth(value: Date | string | null | undefined): string {
  const date = toDate(value);
  return date ? monthFormatter.format(date) : "—";
}

/** « 2 jours », « 1 jour » */
export function formatDays(count: number): string {
  return `${count} ${count > 1 ? "jours" : "jour"}`;
}

function toDate(value: Date | string | null | undefined): Date | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Date du jour à Tahiti, au format ISO (YYYY-MM-DD). */
export function todayInTahiti(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

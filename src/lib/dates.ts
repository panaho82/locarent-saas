/**
 * Dates civiles de Tahiti.
 *
 * Une réservation porte une `DATE` et une `TIME` séparées : manipuler des
 * chaînes `AAAA-MM-JJ` évite les décalages de fuseau qu'introduirait un `Date`
 * local. Ces helpers travaillent en UTC, sur la date civile seule.
 */

/** "2026-11-20" → Date à minuit UTC. */
export function civilDate(iso: string): Date {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

/** Date à minuit UTC → "2026-11-20". */
export function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Décale une date civile de N jours. */
export function addDays(iso: string, days: number): string {
  const date = civilDate(iso);
  date.setUTCDate(date.getUTCDate() + days);
  return isoDate(date);
}

/** Nombre de jours entre deux dates civiles (b − a). */
export function diffDays(a: string, b: string): number {
  return Math.round((civilDate(b).getTime() - civilDate(a).getTime()) / 86_400_000);
}

/** Date du jour à Tahiti (UTC−10). */
export function todayIso(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Pacific/Tahiti",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

const WEEKDAYS = ["DIM", "LUN", "MAR", "MER", "JEU", "VEN", "SAM"];
const MONTHS = [
  "janvier", "février", "mars", "avril", "mai", "juin",
  "juillet", "août", "septembre", "octobre", "novembre", "décembre",
];

export function weekdayShort(iso: string): string {
  return WEEKDAYS[civilDate(iso).getUTCDay()]!;
}

export function dayOfMonth(iso: string): string {
  return iso.slice(8, 10);
}

export function monthLabel(iso: string): string {
  const date = civilDate(iso);
  return `${MONTHS[date.getUTCMonth()]} ${date.getUTCFullYear()}`;
}

export function isWeekend(iso: string): boolean {
  const day = civilDate(iso).getUTCDay();
  return day === 0 || day === 6;
}

/** Premier jour du mois d'une date civile. */
export function startOfMonth(iso: string): string {
  return `${iso.slice(0, 7)}-01`;
}

/** Nombre de jours du mois d'une date civile. */
export function daysInMonth(iso: string): number {
  const [year, month] = iso.split("-").map(Number);
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

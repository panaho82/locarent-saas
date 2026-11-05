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

/**
 * 6630 → « 6 630 XPF »
 *
 * `Intl` insère une espace fine insécable (U+202F) comme séparateur de
 * milliers. À 13 px elle est presque invisible : « 1500 XPF » se lit comme un
 * nombre non groupé. On la remplace par une espace insécable pleine (U+00A0).
 */
export function formatXPF(amount: number | null | undefined): string {
  if (amount === null || amount === undefined || Number.isNaN(amount)) {
    return "—";
  }
  const grouped = integerFormatter
    .format(Math.round(amount))
    .replace(/\u202f/g, "\u00a0");
  return `${grouped} ${CURRENCY}`;
}

/**
 * 01/11/2026 — pour une colonne `DATE` (sans heure).
 *
 * Prisma stocke un `@db.Date` à minuit **UTC**. Le formater dans le fuseau de
 * Tahiti (UTC−10) le ferait reculer d'un jour : le 15 février s'afficherait
 * « 14/02 ». On formate donc ces valeurs en UTC, sans conversion.
 */
export function formatDateOnly(value: Date | string | null | undefined): string {
  const date = toDate(value);
  if (!date) return "—";
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

/** 01/11/2026 — pour un horodatage (converti en heure de Tahiti). */
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

const UNITS = [
  { limit: 60_000, label: "minute", ms: 60_000 },
  { limit: 3_600_000, label: "minute", ms: 60_000 },
  { limit: 86_400_000, label: "heure", ms: 3_600_000 },
  { limit: 2_592_000_000, label: "jour", ms: 86_400_000 },
  { limit: 31_536_000_000, label: "mois", ms: 2_592_000_000 },
] as const;

/** « il y a 23 minutes », « il y a 2 jours » — comme la liste d'origine. */
export function formatRelative(value: Date | string | null | undefined): string {
  const date = toDate(value);
  if (!date) return "—";

  const diff = Date.now() - date.getTime();
  if (diff < 60_000) return "à l'instant";

  for (const unit of UNITS) {
    if (diff < unit.limit) {
      const count = Math.max(1, Math.floor(diff / unit.ms));
      return `il y a ${count} ${unit.label}${count > 1 ? "s" : ""}`;
    }
  }

  const years = Math.floor(diff / 31_536_000_000);
  return `il y a ${years} an${years > 1 ? "s" : ""}`;
}

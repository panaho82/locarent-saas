import { describe, expect, it } from "vitest";
import { formatDate, formatDateOnly, formatXPF, formatRelative } from "@/lib/format";

/**
 * Garde-fous de formatage.
 *
 * Les dates « sans heure » sont stockées à minuit UTC : les formater dans le
 * fuseau de Tahiti (UTC−10) les fait reculer d'un jour. Ce test fixe la règle.
 */

describe("formatXPF", () => {
  it("groupe les milliers avec une espace insécable", () => {
    expect(formatXPF(6630)).toBe("6\u00a0630 XPF");
    expect(formatXPF(1500)).toBe("1\u00a0500 XPF");
    expect(formatXPF(0)).toBe("0 XPF");
  });

  it("n'affiche jamais de décimale", () => {
    expect(formatXPF(1234.6)).toBe("1\u00a0235 XPF");
  });

  it("renvoie un tiret pour une valeur absente", () => {
    expect(formatXPF(null)).toBe("—");
    expect(formatXPF(undefined)).toBe("—");
  });
});

describe("formatDateOnly", () => {
  it("ne décale pas une date sans heure", () => {
    // 15 février à minuit UTC doit rester le 15, pas le 14.
    expect(formatDateOnly(new Date("2026-02-15T00:00:00Z"))).toBe("15/02/2026");
  });

  it("formate de la même façon quelle que soit l'heure du serveur", () => {
    expect(formatDateOnly("2026-11-08T00:00:00.000Z")).toBe("08/11/2026");
  });
});

describe("formatDate", () => {
  it("convertit un horodatage en heure de Tahiti", () => {
    // 1er janvier 2027 à 02:00 UTC = 31 décembre 2026 à 16:00 à Tahiti.
    expect(formatDate(new Date("2027-01-01T02:00:00Z"))).toBe("31/12/2026");
  });
});

describe("formatRelative", () => {
  it("reste lisible pour une date récente", () => {
    expect(formatRelative(new Date())).toBe("à l'instant");
    expect(formatRelative(new Date(Date.now() - 3 * 86_400_000))).toBe("il y a 3 jours");
  });
});

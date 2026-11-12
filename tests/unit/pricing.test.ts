import { describe, expect, it } from "vitest";
import {
  computePrice,
  computeRentalDays,
  rateForUnit,
  suggestBilling,
  toTahitiInstant,
  type RateCard,
} from "@/lib/pricing";

/**
 * Moteur de prix — le module le plus critique du produit.
 *
 * Chaque test correspond à une règle métier de la spec (06-flux.md, section C)
 * ou à un piège connu (arrondis, tolérance, remise négative).
 */

const RATES: RateCard = { daily: 6630, weekly: 39_000, monthly: 140_000 };

describe("conversion date + heure de Tahiti", () => {
  it("convertit une heure locale en instant UTC (UTC−10)", () => {
    // 21/10/2026 08:00 à Tahiti = 18:00 UTC le même jour.
    expect(new Date(toTahitiInstant("2026-10-21", "08:00")).toISOString()).toBe(
      "2026-10-21T18:00:00.000Z",
    );
  });

  it("refuse une date invalide plutôt que de produire NaN", () => {
    expect(() => toTahitiInstant("pas-une-date", "08:00")).toThrow(RangeError);
  });
});

describe("nombre de jours facturés", () => {
  it("compte 2 jours pour 48 heures pile", () => {
    expect(computeRentalDays("2026-10-21", "08:00", "2026-10-23", "08:00")).toBe(2);
  });

  it("arrondit au jour supérieur au-delà de l'heure de départ", () => {
    // 21/10 08:00 → 23/10 10:00 : 50 h, soit 2 jours + 2 h.
    expect(computeRentalDays("2026-10-21", "08:00", "2026-10-23", "10:00")).toBe(3);
  });

  it("applique la tolérance de retard sans facturer un jour de plus", () => {
    // Même cas, avec 3 h de tolérance : les 2 h de retard sont absorbées.
    expect(computeRentalDays("2026-10-21", "08:00", "2026-10-23", "11:00", 3)).toBe(2);
  });

  it("facture au minimum un jour, même pour quelques heures", () => {
    expect(computeRentalDays("2026-10-21", "08:00", "2026-10-21", "18:00")).toBe(1);
  });

  it("refuse une location dont le retour précède le départ", () => {
    expect(() => computeRentalDays("2026-10-23", "08:00", "2026-10-21", "08:00")).toThrow(
      RangeError,
    );
  });
});

describe("unité de facturation suggérée", () => {
  it("reste en jours sous une semaine", () => {
    expect(suggestBilling(3, RATES)).toEqual({ unit: "days", value: 3, total: 3 * 6630 });
  });

  it("bascule en semaines quand c'est moins cher que le tarif journalier", () => {
    // 7 jours × 6630 = 46 410 > 39 000 la semaine.
    expect(suggestBilling(7, RATES)).toEqual({ unit: "weeks", value: 1, total: 39_000 });
  });

  it("ne suggère jamais une formule plus chère qu'une autre", () => {
    const suggestion = suggestBilling(10, RATES);
    expect(suggestion.total).toBeLessThanOrEqual(10 * RATES.daily);
  });

  it("retombe sur un multiple du jour si le tarif hebdomadaire est absent", () => {
    expect(rateForUnit({ daily: 5000, weekly: null, monthly: null }, "weeks")).toBe(35_000);
    expect(rateForUnit({ daily: 5000, weekly: null, monthly: null }, "months")).toBe(150_000);
  });
});

describe("prix d'une réservation", () => {
  const base = {
    startDate: "2026-10-21",
    startTime: "08:00",
    endDate: "2026-10-23",
    endTime: "08:00",
    unit: "days" as const,
    value: 2,
    rates: RATES,
  };

  it("facture la durée × tarif journalier", () => {
    const result = computePrice(base);
    expect(result.rentalDays).toBe(2);
    expect(result.vehicleTotal).toBe(13_260);
    expect(result.totalPrice).toBe(13_260);
    expect(result.totalWithTax).toBe(13_260); // TVA désactivée par défaut
  });

  it("ajoute les options : par jour et forfait", () => {
    const result = computePrice({
      ...base,
      extras: [
        { name: "GPS", unitPrice: 1500, priceType: "per_day", qty: 1 },
        { name: "Siège enfant", unitPrice: 1000, priceType: "per_rental", qty: 2 },
      ],
    });

    expect(result.extrasTotal).toBe(1500 * 2 + 1000 * 2);
    expect(result.totalPrice).toBe(13_260 + 5000);
  });

  it("ajoute les frais de lieux", () => {
    const result = computePrice({ ...base, pickupFee: 2000, dropoffFee: 1500 });
    expect(result.locationsTotal).toBe(3500);
    expect(result.totalPrice).toBe(13_260 + 3500);
  });

  it("applique une remise en pourcentage sur le sous-total", () => {
    const result = computePrice({
      ...base,
      discounts: [{ label: "Remise agence", type: "percent", value: 10 }],
    });
    expect(result.discountsTotal).toBe(1326);
    expect(result.totalPrice).toBe(11_934);
  });

  it("applique les remises dans l'ordre, en pourcentage puis en montant", () => {
    const result = computePrice({
      ...base,
      discounts: [
        { type: "percent", value: 10 },
        { type: "amount", value: 1000 },
      ],
    });
    expect(result.discountsTotal).toBe(1326 + 1000);
    expect(result.totalPrice).toBe(13_260 - 1326 - 1000);
  });

  it("ne laisse jamais une remise rendre le total négatif", () => {
    const result = computePrice({
      ...base,
      discounts: [{ type: "amount", value: 99_999 }],
    });
    expect(result.totalPrice).toBe(0);
    expect(result.discountsTotal).toBe(13_260);
  });

  it("calcule la TVA à 13 % quand elle est activée", () => {
    const result = computePrice({ ...base, tvaEnabled: true, taxRate: 13 });
    expect(result.taxAmount).toBe(Math.round((13_260 * 13) / 100));
    expect(result.totalWithTax).toBe(13_260 + result.taxAmount);
  });

  it("ignore le taux de TVA si le module est désactivé", () => {
    const result = computePrice({ ...base, tvaEnabled: false, taxRate: 13 });
    expect(result.taxAmount).toBe(0);
    expect(result.totalWithTax).toBe(result.totalPrice);
  });

  it("arrondit au franc et ne produit que des entiers", () => {
    const result = computePrice({
      startDate: "2026-10-21",
      startTime: "08:00",
      endDate: "2026-10-21",
      endTime: "18:00",
      unit: "days",
      value: 1,
      rates: { daily: 6633, weekly: null, monthly: null },
      tvaEnabled: true,
      taxRate: 13,
    });

    expect(Number.isInteger(result.totalPrice)).toBe(true);
    expect(Number.isInteger(result.taxAmount)).toBe(true);
    expect(result.taxAmount).toBe(Math.round((6633 * 13) / 100));
  });

  it("produit un détail lisible pour l'écran", () => {
    const result = computePrice({
      ...base,
      extras: [{ name: "GPS", unitPrice: 1500, priceType: "per_day", qty: 1 }],
      discounts: [{ label: "Geste commercial", type: "amount", value: 500 }],
    });

    const labels = result.lines.map((line) => line.label);
    expect(labels).toContain("Location 2 jours");
    expect(labels).toContain("GPS (1 × 2 j)");
    expect(labels).toContain("Geste commercial");

    const sum = result.lines.reduce((total, line) => total + line.amount, 0);
    expect(sum).toBe(result.totalPrice);
  });

  it("applique un montant de location négocié, options et frais en plus", () => {
    const result = computePrice({
      ...base,
      vehicleTotalOverride: 11_000,
      extras: [{ name: "GPS", unitPrice: 1500, priceType: "per_rental", qty: 1 }],
      pickupFee: 500,
    });

    expect(result.computedVehicleTotal).toBe(13_260); // ce que le moteur aurait facturé
    expect(result.vehicleTotal).toBe(11_000); // ce qui est appliqué
    expect(result.totalPrice).toBe(11_000 + 1500 + 500);
    expect(result.lines[0]?.label).toContain("tarif négocié");
  });

  it("n'affiche pas la mention « négocié » quand le montant est identique", () => {
    const result = computePrice({ ...base, vehicleTotalOverride: 13_260 });
    expect(result.vehicleTotal).toBe(13_260);
    expect(result.lines[0]?.label).not.toContain("négocié");
  });

  it("refuse une durée facturée nulle ou négative", () => {
    expect(() => computePrice({ ...base, value: 0 })).toThrow(RangeError);
    expect(() => computePrice({ ...base, value: -1 })).toThrow(RangeError);
  });

  it("facture un forfait semaine sur une durée de 7 jours", () => {
    const result = computePrice({
      startDate: "2026-10-21",
      startTime: "08:00",
      endDate: "2026-10-28",
      endTime: "08:00",
      unit: "weeks",
      value: 1,
      rates: RATES,
    });

    expect(result.rentalDays).toBe(7);
    expect(result.vehicleTotal).toBe(39_000);
  });
});

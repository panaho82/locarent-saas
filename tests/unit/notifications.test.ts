import { describe, expect, it } from "vitest";
import { buildCheckInNotification } from "@/server/notifications";

/**
 * Notification d'agence après un check-in.
 *
 * Le message est construit par une fonction pure : on vérifie son contenu sans
 * base ni réseau. Un email de notification manquant ou maladressé, c'est un
 * contrat signé que personne ne voit arriver.
 */

const BASE = {
  tenantName: "Raiatea Rent Car",
  agencyEmail: "contact@raiatea-rent.pf",
  bookingNumber: "B-2026-00042",
  bookingId: 42,
  customerName: "Franck Teriitaumihau",
  vehicleName: "Dacia Sandero",
  licensePlate: "845 120 P",
  startDate: "20/11/2026",
  endDate: "22/11/2026",
  signerName: "Franck Teriitaumihau",
  signedAt: new Date("2026-11-19T18:30:00Z"),
  contractHash: "a".repeat(64),
};

describe("notification de check-in", () => {
  it("est adressée à l'agence", () => {
    expect(buildCheckInNotification(BASE).to).toBe("contact@raiatea-rent.pf");
  });

  it("annonce la réservation et le client dans l'objet", () => {
    const { subject } = buildCheckInNotification(BASE);
    expect(subject).toContain("B-2026-00042");
    expect(subject).toContain("Franck Teriitaumihau");
    expect(subject).toContain("Contrat signé");
  });

  it("reprend le véhicule, la période et le signataire", () => {
    const { text } = buildCheckInNotification(BASE);
    expect(text).toContain("Dacia Sandero (845 120 P)");
    expect(text).toContain("du 20/11/2026 au 22/11/2026");
    expect(text).toContain("Signataire    : Franck Teriitaumihau");
  });

  it("contient l'empreinte du contrat et le lien vers la réservation", () => {
    const { text } = buildCheckInNotification(BASE);
    expect(text).toContain("a".repeat(64));
    expect(text).toContain("/admin/reservations/42");
  });

  it("salue l'agence par son nom", () => {
    expect(buildCheckInNotification(BASE).text).toContain("Bonjour Raiatea Rent Car");
  });
});

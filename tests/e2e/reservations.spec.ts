import "dotenv/config";
import { expect, test } from "@playwright/test";
import { prisma } from "../../src/server/db";

/**
 * Réservations : création au comptoir, calcul du prix, détection de conflit.
 */

const runId = Math.random().toString(36).slice(2, 8);
const password = "motdepasse-resa-1";

test.afterAll(async () => {
  await prisma.tenant.deleteMany({ where: { slug: { contains: runId } } });
  await prisma.user.deleteMany({ where: { email: { contains: runId } } });
  await prisma.$disconnect();
});

test("créer une réservation, vérifier le prix, refuser un chevauchement", async ({ page }) => {
  await page.goto("/register");
  await page.fill("#tenantName", `Resa ${runId}`);
  await page.fill("#name", "Gérant Résa");
  await page.fill("#email", `resa-${runId}@locarent.test`);
  await page.fill("#password", password);
  await page.fill("#passwordConfirmation", password);
  await page.getByRole("button", { name: "Créer mon agence" }).click();
  await expect(page).toHaveURL(/\/admin\/index$/);

  // Un véhicule à 6 630 / jour.
  await page.goto("/admin/cars/new");
  await page.fill("#name", "Renault Kwid");
  await page.fill("#licensePlate", "276 969 P");
  await page.getByRole("button", { name: /Ajouter la tarification/ }).click();
  await page.fill("#dailyRate", "6630");
  await page.getByRole("button", { name: "Ajouter le véhicule" }).click();
  await expect(page).toHaveURL(/\/admin\/cars\/\d+$/, { timeout: 15000 });

  // Un client.
  await page.goto("/admin/customers/new");
  await page.fill("#firstName", "Franck");
  await page.fill("#lastName", "Teriitaumihau");
  await page.getByRole("button", { name: "Ajouter le client" }).click();
  await expect(page).toHaveURL(/\/admin\/customers\/\d+$/, { timeout: 15000 });

  // Réservation de 2 jours.
  await page.goto("/admin/reservations/new");
  await page.selectOption("#customerId", { index: 1 });
  await page.selectOption("#vehicleId", { index: 1 });
  await page.fill("#startDate", "2026-11-20");
  await page.fill("#endDate", "2026-11-22");
  await page.fill("#value", "2");

  // Le récapitulatif client affiche le prix avant enregistrement.
  await expect(page.getByText("13 260 XPF").first()).toBeVisible();

  await page.getByRole("button", { name: "Enregistrer la réservation" }).click();
  await expect(page).toHaveURL(/\/admin\/reservations\/\d+$/, { timeout: 20000 });

  // Numéro et montant sur la fiche.
  await expect(page.getByRole("heading", { name: /^B-\d{4}-\d{5}$/ })).toBeVisible();
  await expect(page.getByText("13 260 XPF").first()).toBeVisible();
  await expect(page.getByText("Confirmée").first()).toBeVisible();

  // Deuxième réservation sur la même période : refusée.
  await page.goto("/admin/reservations/new");
  await page.selectOption("#customerId", { index: 1 });
  await page.selectOption("#vehicleId", { index: 1 });
  await page.fill("#startDate", "2026-11-21");
  await page.fill("#endDate", "2026-11-23");
  await page.fill("#value", "2");
  await page.getByRole("button", { name: "Enregistrer la réservation" }).click();

  await expect(
    page.getByRole("alert").filter({ hasText: "indisponible sur cette période" }),
  ).toBeVisible();
  await expect(page).toHaveURL(/\/admin\/reservations\/new$/);

  // La liste contient la réservation.
  await page.goto("/admin/reservations");
  await expect(page.getByText("B-2026-00001")).toBeVisible();
  await expect(page.getByText("13 260 XPF")).toBeVisible();

  // Modification : 3 jours au lieu de 2, le prix est recalculé.
  await page.getByRole("link", { name: "B-2026-00001", exact: true }).click();
  await page.getByRole("link", { name: "Modifier" }).click();
  await expect(page).toHaveURL(/\/admin\/reservations\/\d+\/edit$/);
  await page.fill("#value", "3");
  await page.getByRole("button", { name: "Enregistrer les modifications" }).click();
  await expect(page).toHaveURL(/\/admin\/reservations\/\d+$/, { timeout: 20000 });
  await expect(page.getByText("19 890 XPF").first()).toBeVisible();
});

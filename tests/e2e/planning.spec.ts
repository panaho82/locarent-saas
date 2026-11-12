import "dotenv/config";
import { expect, test } from "@playwright/test";
import { prisma } from "../../src/server/db";

/**
 * Planning flotte : glisser-déposer d'une réservation, avec revérification
 * de la disponibilité côté serveur.
 */

const runId = Math.random().toString(36).slice(2, 8);
const password = "motdepasse-planning-1";

test.afterAll(async () => {
  await prisma.tenant.deleteMany({ where: { slug: { contains: runId } } });
  await prisma.user.deleteMany({ where: { email: { contains: runId } } });
  await prisma.$disconnect();
});

test("déplacer une réservation dans le planning", async ({ page }) => {
  await page.goto("/register");
  await page.fill("#tenantName", `Planning ${runId}`);
  await page.fill("#name", "Gérant Planning");
  await page.fill("#email", `planning-${runId}@locarent.test`);
  await page.fill("#password", password);
  await page.fill("#passwordConfirmation", password);
  await page.getByRole("button", { name: "Créer mon agence" }).click();
  await expect(page).toHaveURL(/\/admin\/index$/);

  // Véhicule
  await page.goto("/admin/cars/new");
  await page.fill("#name", "Renault Kwid");
  await page.fill("#licensePlate", "276 969 P");
  await page.getByRole("button", { name: /Ajouter la tarification/ }).click();
  await page.fill("#dailyRate", "6630");
  await page.getByRole("button", { name: "Ajouter le véhicule" }).click();
  await expect(page).toHaveURL(/\/admin\/cars\/\d+$/, { timeout: 15000 });

  // Client
  await page.goto("/admin/customers/new");
  await page.fill("#firstName", "Franck");
  await page.fill("#lastName", "Teriitaumihau");
  await page.getByRole("button", { name: "Ajouter le client" }).click();
  await expect(page).toHaveURL(/\/admin\/customers\/\d+$/, { timeout: 15000 });

  // Réservation du 5 au 7 décembre.
  await page.goto("/admin/reservations/new");
  await page.selectOption("#customerId", { index: 1 });
  await page.selectOption("#vehicleId", { index: 1 });
  await page.fill("#startDate", "2026-12-05");
  await page.fill("#endDate", "2026-12-07");
  await page.getByRole("button", { name: "Enregistrer la réservation" }).click();
  await expect(page).toHaveURL(/\/admin\/reservations\/\d+$/, { timeout: 20000 });
  const bookingUrl = page.url();

  // Planning sur la période.
  await page.goto("/admin/planning?from=2026-12-01");
  const bar = page.locator('a[href^="/admin/reservations/"]').filter({ hasText: "B-2026-00001" });
  await expect(bar).toBeVisible();

  // Glisser du 5 au 10 décembre.
  const target = page.locator('[data-planning-cell][data-date="2026-12-10"]');
  await bar.dragTo(target);

  await expect(page.getByText("Réservation déplacée.")).toBeVisible({ timeout: 15000 });

  // La fiche confirme la nouvelle date.
  await page.goto(bookingUrl);
  await expect(page.getByText("10/12/2026")).toBeVisible();
  await expect(page.getByText("12/12/2026")).toBeVisible(); // durée conservée
});

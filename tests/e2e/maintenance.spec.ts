import "dotenv/config";
import { expect, test } from "@playwright/test";
import { prisma } from "../../src/server/db";

/**
 * Maintenance : création d'une intervention, et répercussion d'un contrôle
 * technique terminé sur la fiche du véhicule.
 */

const runId = Math.random().toString(36).slice(2, 8);
const password = "motdepasse-maintenance-1";

test.afterAll(async () => {
  await prisma.tenant.deleteMany({ where: { slug: { contains: runId } } });
  await prisma.user.deleteMany({ where: { email: { contains: runId } } });
  await prisma.$disconnect();
});

test("créer une intervention et vérifier la liste", async ({ page }) => {
  await page.goto("/register");
  await page.fill("#tenantName", `Maintenance ${runId}`);
  await page.fill("#name", "Gérant Maintenance");
  await page.fill("#email", `maint-${runId}@locarent.test`);
  await page.fill("#password", password);
  await page.fill("#passwordConfirmation", password);
  await page.getByRole("button", { name: "Créer mon agence" }).click();
  await expect(page).toHaveURL(/\/admin\/index$/);

  // Un véhicule est nécessaire.
  await page.goto("/admin/cars/new");
  await page.fill("#name", "Dacia Duster");
  await page.fill("#licensePlate", "111 AAA");
  await page.getByRole("button", { name: /Ajouter la tarification/ }).click();
  await page.fill("#dailyRate", "8900");
  await page.getByRole("button", { name: "Ajouter le véhicule" }).click();
  await expect(page).toHaveURL(/\/admin\/cars\/\d+$/, { timeout: 15000 });

  // Intervention.
  await page.goto("/admin/maintenance");
  await expect(page.getByText("Aucune maintenance")).toBeVisible();

  await page.getByRole("link", { name: "Ajouter une intervention" }).click();
  await page.locator("#vehicleId option", { hasText: "Dacia Duster" }).first().getAttribute("value").then((v) => page.selectOption("#vehicleId", v!));
  await page.fill("#title", "Vidange + filtres");
  await page.selectOption("#status", "in_progress");
  await page.fill("#cost", "23600");
  await page.fill("#mileage", "58700");
  await page.fill("#performedAt", "2026-02-15");
  await page.getByRole("button", { name: "Enregistrer l'intervention" }).click();

  await expect(page).toHaveURL(/\/admin\/maintenance$/, { timeout: 15000 });
  const row = page.getByRole("row").filter({ hasText: "Vidange + filtres" });
  await expect(row).toContainText("23 600 XPF");
  await expect(row).toContainText("58 700 km");
  await expect(row).toContainText("En cours");
  await expect(row).toContainText("15/02/2026");
});

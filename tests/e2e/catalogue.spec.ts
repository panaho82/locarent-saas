import "dotenv/config";
import { expect, test } from "@playwright/test";
import { prisma } from "../../src/server/db";

/**
 * Catalogue de l'agence : emplacements et services supplémentaires.
 */

const runId = Math.random().toString(36).slice(2, 8);
const password = "motdepasse-catalogue-1";

test.afterAll(async () => {
  await prisma.tenant.deleteMany({ where: { slug: { contains: runId } } });
  await prisma.user.deleteMany({ where: { email: { contains: runId } } });
  await prisma.$disconnect();
});

test("créer un emplacement puis un service supplémentaire", async ({ page }) => {
  // Agence neuve.
  await page.goto("/register");
  await page.fill("#tenantName", `Catalogue ${runId}`);
  await page.fill("#name", "Gérant Catalogue");
  await page.fill("#email", `catalogue-${runId}@locarent.test`);
  await page.fill("#password", password);
  await page.fill("#passwordConfirmation", password);
  await page.getByRole("button", { name: "Créer mon agence" }).click();
  await expect(page).toHaveURL(/\/admin\/index$/);

  // --- Emplacements ---
  await page.goto("/admin/locations");
  await expect(page.getByText("Aucun emplacement")).toBeVisible();

  await page.getByRole("link", { name: "Ajouter un emplacement" }).click();
  await page.fill("#name", "Agence Uturoa");
  await page.fill("#address", "Quai des Pêcheurs");
  await page.fill("#island", "Raiatea");
  await page.getByRole("button", { name: "Ajouter l'emplacement" }).click();

  await expect(page).toHaveURL(/\/admin\/locations$/, { timeout: 15000 });
  const locationRow = page.getByRole("row").filter({ hasText: "Agence Uturoa" });
  await expect(locationRow).toContainText("Gratuit");
  await expect(locationRow).toContainText("Quai des Pêcheurs");

  // --- Services supplémentaires ---
  await page.goto("/admin/extra-services");
  await expect(page.getByText("Aucun service supplémentaire")).toBeVisible();

  await page.getByRole("link", { name: "Ajouter un service" }).first().click();
  await page.fill("#name", "GPS");
  await page.fill("#description", "Navigation GPS portable");
  await page.fill("#price", "1500");
  await page.selectOption("#priceType", "per_day");
  await page.getByRole("button", { name: "Ajouter le service" }).click();

  await expect(page).toHaveURL(/\/admin\/extra-services$/, { timeout: 15000 });
  const serviceRow = page.getByRole("row").filter({ hasText: "GPS" });
  await expect(serviceRow).toContainText("1 500 XPF");
  await expect(serviceRow).toContainText("Par jour");
  await expect(serviceRow).toContainText("Public");
});

test("créer une catégorie depuis le formulaire véhicule", async ({ page }) => {
  const id = Math.random().toString(36).slice(2, 7);

  await page.goto("/register");
  await page.fill("#tenantName", `Categorie ${id}`);
  await page.fill("#name", "Gérant Catégorie");
  await page.fill("#email", `cat-${id}@locarent.test`);
  await page.fill("#password", password);
  await page.fill("#passwordConfirmation", password);
  await page.getByRole("button", { name: "Créer mon agence" }).click();
  await expect(page).toHaveURL(/\/admin\/index$/);

  await page.goto("/admin/cars/new");
  await page.getByText("Nouvelle catégorie").click();
  await page.fill('input[name="categoryName"]', "Scooter");
  await page.getByRole("button", { name: "Créer", exact: true }).click();
  await expect(page.getByText("Catégorie « Scooter » créée.")).toBeVisible();

  // La catégorie apparaît dans la liste déroulante après rechargement.
  await expect(
    page.locator("#categoryId option", { hasText: "Scooter" }),
  ).toHaveCount(1);

  await prisma.tenant.deleteMany({ where: { slug: { contains: id } } });
  await prisma.user.deleteMany({ where: { email: { contains: id } } });
});

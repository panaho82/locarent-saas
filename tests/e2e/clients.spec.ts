import "dotenv/config";
import { expect, test } from "@playwright/test";
import { prisma } from "../../src/server/db";

/**
 * Clients, conducteurs et entreprises.
 */

const runId = Math.random().toString(36).slice(2, 8);
const password = "motdepasse-clients-1";

test.afterAll(async () => {
  await prisma.tenant.deleteMany({ where: { slug: { contains: runId } } });
  await prisma.user.deleteMany({ where: { email: { contains: runId } } });
  await prisma.$disconnect();
});

test("créer un client, lui ajouter un conducteur", async ({ page }) => {
  await page.goto("/register");
  await page.fill("#tenantName", `Clients ${runId}`);
  await page.fill("#name", "Gérant Clients");
  await page.fill("#email", `clients-${runId}@locarent.test`);
  await page.fill("#password", password);
  await page.fill("#passwordConfirmation", password);
  await page.getByRole("button", { name: "Créer mon agence" }).click();
  await expect(page).toHaveURL(/\/admin\/index$/);

  await page.goto("/admin/customers");
  await expect(page.getByText("Aucun résultat trouvé")).toBeVisible();

  await page.getByRole("link", { name: "Ajouter un client" }).click();
  await page.fill("#firstName", "Franck");
  await page.fill("#lastName", "Teriitaumihau");
  await page.fill("#email", `franck-${runId}@exemple.pf`);
  await page.fill("#phone", "89 43 09 86");
  await page.fill("#city", "Uturoa");
  await page.getByRole("button", { name: "Ajouter le client" }).click();

  await expect(page).toHaveURL(/\/admin\/customers\/\d+$/, { timeout: 15000 });
  await expect(page.getByRole("heading", { name: "FRANCK TERIITAUMIHAU" })).toBeVisible();
  await expect(page.getByText("Particulier").first()).toBeVisible();

  // Conducteur
  await page.getByRole("link", { name: "Conducteurs" }).click();
  await page.fill("#driverFirstName", "Franck");
  await page.fill("#driverLastName", "Teriitaumihau");
  await page.fill("#licenseCardNumber", "123456789");
  await page.getByRole("checkbox", { name: "Conducteur principal" }).check();
  await page.getByRole("button", { name: "Ajouter le conducteur" }).click();
  await expect(page.getByText("Conducteur ajouté.")).toBeVisible();
  // Le badge « Principal » est dans la ligne du conducteur (le mot apparaît
  // aussi dans la case à cocher du formulaire).
  const driverRow = page.locator("li").filter({ hasText: "123456789" });
  await expect(driverRow).toContainText("Principal");

  // La liste reflète le client et son conducteur
  await page.goto("/admin/customers");
  const row = page.getByRole("row").filter({ hasText: "FRANCK TERIITAUMIHAU" });
  await expect(row).toContainText("1 conducteur(s)");
  await expect(row).toContainText("0 Location(s)"); // aucune réservation encore
});

test("créer une entreprise et la retrouver dans l'onglet Entreprises", async ({ page }) => {
  const id = Math.random().toString(36).slice(2, 7);

  await page.goto("/register");
  await page.fill("#tenantName", `Entreprise ${id}`);
  await page.fill("#name", "Gérant Société");
  await page.fill("#email", `sté-${id}@locarent.test`);
  await page.fill("#password", password);
  await page.fill("#passwordConfirmation", password);
  await page.getByRole("button", { name: "Créer mon agence" }).click();
  await expect(page).toHaveURL(/\/admin\/index$/);

  await page.goto("/admin/customers?tab=companies");
  await page.getByRole("link", { name: "Ajouter une entreprise" }).click();

  await page.fill("#name", "Hôtel Raiatea Lodge");
  await page.fill("#contactName", "Mme Teura");
  await page.fill("#email", "compta@lodge.pf");
  await page.fill("#taxId", "123456");
  await page.fill("#city", "Uturoa");
  await page.getByRole("button", { name: "Ajouter l'entreprise" }).click();

  await expect(page).toHaveURL(/\/admin\/companies\/\d+$/, { timeout: 15000 });

  await page.goto("/admin/customers?tab=companies");
  const row = page.getByRole("row").filter({ hasText: "Hôtel Raiatea Lodge" });
  await expect(row).toContainText("compta@lodge.pf");

  await prisma.tenant.deleteMany({ where: { slug: { contains: id } } });
  await prisma.user.deleteMany({ where: { email: { contains: id } } });
});

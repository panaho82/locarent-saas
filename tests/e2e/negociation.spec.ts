import "dotenv/config";
import { expect, test, type Page } from "@playwright/test";
import { prisma } from "../../src/server/db";

/**
 * Tarif négocié (permission `booking.negotiate_rate`).
 *
 * Trois règles à prouver :
 *  1. un agent habilité peut fixer le montant de la location ;
 *  2. sans la permission, le serveur refuse — même si le formulaire est forcé ;
 *  3. le prix est figé : changer le tarif du véhicule ensuite ne le modifie pas.
 */

const runId = Math.random().toString(36).slice(2, 8);
const password = "motdepasse-nego-1";

test.afterAll(async () => {
  await prisma.tenant.deleteMany({ where: { slug: { contains: runId } } });
  await prisma.user.deleteMany({ where: { email: { contains: runId } } });
  await prisma.$disconnect();
});

async function registerOwner(page: Page, suffix: string) {
  await page.goto("/register");
  await page.fill("#tenantName", `Nego ${suffix}`);
  await page.fill("#name", "Propriétaire Nego");
  await page.fill("#email", `proprio-${suffix}@locarent.test`);
  await page.fill("#password", password);
  await page.fill("#passwordConfirmation", password);
  await page.getByRole("button", { name: "Créer mon agence" }).click();
  await expect(page).toHaveURL(/\/admin\/index$/);
}

async function seedParc(page: Page) {
  await page.goto("/admin/cars/new");
  await page.fill("#name", "Renault Kwid");
  await page.fill("#licensePlate", "276 969 P");
  await page.getByRole("button", { name: /Ajouter la tarification/ }).click();
  await page.fill("#dailyRate", "6630");
  await page.getByRole("button", { name: "Ajouter le véhicule" }).click();
  await expect(page).toHaveURL(/\/admin\/cars\/\d+$/, { timeout: 15000 });

  await page.goto("/admin/customers/new");
  await page.fill("#firstName", "Franck");
  await page.fill("#lastName", "Teriitaumihau");
  await page.getByRole("button", { name: "Ajouter le client" }).click();
  await expect(page).toHaveURL(/\/admin\/customers\/\d+$/, { timeout: 15000 });
}

test("le propriétaire négocie le prix de la location", async ({ page }) => {
  const id = `${runId}-a`;
  await registerOwner(page, id);
  await seedParc(page);

  await page.goto("/admin/reservations/new");
  await page.selectOption("#customerId", { index: 1 });
  await page.selectOption("#vehicleId", { index: 1 });
  await page.fill("#startDate", "2026-12-10");
  await page.fill("#endDate", "2026-12-12");
  // Retour à la même heure que le départ : exactement 2 jours facturés.
  await page.locator('input[name="endTime"]').fill("08:00");
  await page.waitForTimeout(500);

  // Le champ est pré-rempli avec le prix calculé (2 × 6 630).
  await expect(page.locator("#negotiatedTotal")).toHaveValue("13260");

  // Négociation à 11 000 : les options et frais s'ajouteraient par-dessus.
  await page.fill("#negotiatedTotal", "11000");
  await expect(page.getByText("11 000 XPF").first()).toBeVisible();

  await page.getByRole("button", { name: "Enregistrer la réservation" }).click();
  await expect(page).toHaveURL(/\/admin\/reservations\/\d+$/, { timeout: 20000 });

  await expect(page.getByText("tarif négocié")).toBeVisible();
  await expect(page.getByText("Prix calculé avant négociation")).toBeVisible();
  await expect(page.getByText("13 260 XPF")).toBeVisible(); // barré
  await expect(page.getByText("11 000 XPF").first()).toBeVisible();
});

test("sans la permission, le serveur refuse le prix négocié", async ({ page, browser }) => {
  const id = `${runId}-b`;
  const memberEmail = `membre-${id}@locarent.test`;

  await registerOwner(page, id);
  await seedParc(page);

  // Invitation avec la seule permission de création (pas de négociation).
  await page.goto("/admin/settings/team");
  await page.fill("#invite-email", memberEmail);
  await page.getByText("Permissions accordées").click();
  await page.getByLabel("Créer une réservation").check();
  await page.getByRole("button", { name: "Envoyer l'invitation" }).click();

  const alert = page.getByRole("alert").filter({ hasText: "Invitation créée" });
  await expect(alert).toBeVisible();
  const link = (await alert.innerText()).match(/https?:\/\/\S+/)?.[0];
  expect(link).toBeTruthy();

  // Le membre accepte et se connecte dans un contexte vierge.
  const memberContext = await browser.newContext();
  const memberPage = await memberContext.newPage();
  await memberPage.goto(link!);
  await memberPage.fill("#name", "Membre Nego");
  await memberPage.fill("#password", password);
  await memberPage.fill("#passwordConfirmation", password);
  await memberPage.getByRole("button", { name: "Rejoindre l'agence" }).click();
  await expect(memberPage).toHaveURL(/\/admin\/index$/);

  await memberPage.goto("/admin/reservations/new");
  await memberPage.selectOption("#customerId", { index: 1 });
  await memberPage.selectOption("#vehicleId", { index: 1 });
  await memberPage.fill("#startDate", "2026-12-15");
  await memberPage.fill("#endDate", "2026-12-17");

  // Le champ est désactivé… mais un client malin peut forcer la requête :
  // on s'assure que le refus vient bien du serveur.
  await memberPage.locator("#negotiatedTotal").evaluate((el: HTMLInputElement) => {
    el.disabled = false;
  });
  await memberPage.fill("#negotiatedTotal", "1000");
  await memberPage.getByRole("button", { name: "Enregistrer la réservation" }).click();

  await expect(
    memberPage.getByRole("alert").filter({ hasText: "ne permet pas de modifier le prix" }),
  ).toBeVisible();
  await expect(memberPage).toHaveURL(/\/admin\/reservations\/new$/);

  await memberContext.close();
});

test("le prix reste figé après un changement de tarif du véhicule", async ({ page }) => {
  const id = `${runId}-c`;
  await registerOwner(page, id);
  await seedParc(page);

  await page.goto("/admin/reservations/new");
  await page.selectOption("#customerId", { index: 1 });
  await page.selectOption("#vehicleId", { index: 1 });
  await page.fill("#startDate", "2026-12-20");
  await page.fill("#endDate", "2026-12-22");
  await page.locator('input[name="endTime"]').fill("08:00");
  await page.getByRole("button", { name: "Enregistrer la réservation" }).click();
  await expect(page).toHaveURL(/\/admin\/reservations\/\d+$/, { timeout: 20000 });
  const bookingUrl = page.url();
  await expect(page.getByText("13 260 XPF").first()).toBeVisible();

  // Le tarif du véhicule passe à 9 999 / jour.
  await page.goto("/admin/cars");
  await page.getByRole("link", { name: /Renault Kwid/ }).first().click();
  await page.getByRole("button", { name: "Tarification", exact: true }).click();
  await page.fill("#dailyRate", "9999");
  await page.getByRole("button", { name: "Enregistrer" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Véhicule mis à jour" })).toBeVisible();

  // La réservation n'a pas bougé.
  await page.goto(bookingUrl);
  await expect(page.getByText("13 260 XPF").first()).toBeVisible();
});

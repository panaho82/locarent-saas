import "dotenv/config";
import { expect, test } from "@playwright/test";
import { prisma } from "../../src/server/db";

/**
 * Parc automobile — parcours réel.
 *
 * Couvre la chaîne complète : formulaire → Server Action → base (avec le
 * contexte d'agence) → redirection → liste.
 */

const runId = Math.random().toString(36).slice(2, 8);
const password = "motdepasse-cars-1";
const email = `cars-${runId}@locarent.test`;
const agency = `Parc ${runId}`;

test.afterAll(async () => {
  await prisma.tenant.deleteMany({ where: { slug: { contains: runId } } });
  await prisma.user.deleteMany({ where: { email: { contains: runId } } });
  await prisma.$disconnect();
});

test("ajouter un véhicule, le voir dans la liste, puis le modifier", async ({ page }) => {
  // 1. Une agence neuve (aucun véhicule).
  await page.goto("/register");
  await page.fill("#tenantName", agency);
  await page.fill("#name", "Gérant Parc");
  await page.fill("#email", email);
  await page.fill("#password", password);
  await page.fill("#passwordConfirmation", password);
  await page.getByRole("button", { name: "Créer mon agence" }).click();
  await expect(page).toHaveURL(/\/admin\/index$/);

  await page.goto("/admin/cars");
  await expect(page.getByText("Aucun véhicule")).toBeVisible();

  // 2. Création.
  await page.getByRole("link", { name: "Ajouter un véhicule" }).click();
  await expect(page).toHaveURL(/\/admin\/cars\/new$/);

  await page.fill("#name", "Renault Kwid");
  await page.fill("#model", "KWID");
  await page.fill("#licensePlate", "276 969 P");

  // Tarification : le bouton bascule d'onglet, le prix est obligatoire.
  await page.getByRole("button", { name: /Ajouter la tarification/ }).click();
  await page.fill("#dailyRate", "6630");
  await page.fill("#weeklyRate", "39000");
  await page.getByRole("button", { name: "Ajouter le véhicule" }).click();

  // 3. Redirection vers la fiche + présence en liste.
  await expect(page).toHaveURL(/\/admin\/cars\/\d+$/, { timeout: 15000 });

  await page.goto("/admin/cars");
  await expect(page.getByRole("link", { name: /Renault Kwid/ }).first()).toBeVisible();
  await expect(page.getByText("1 entrée au total")).toBeVisible();
  await expect(
    page.getByRole("row").filter({ hasText: "Renault Kwid" }),
  ).toContainText("Disponible");

  // 4. Modification du tarif.
  await page.getByRole("link", { name: /Renault Kwid/ }).first().click();
  await page.getByRole("button", { name: "Tarification", exact: true }).click();
  await page.fill("#dailyRate", "7100");
  await page.getByRole("button", { name: "Enregistrer" }).click();
  await expect(
    page.getByRole("alert").filter({ hasText: "Véhicule mis à jour" }),
  ).toBeVisible();

  await page.goto("/admin/cars");
  await expect(page.getByText("7100")).toBeVisible();
});

test("immatriculation en double : erreur de champ, pas d'exception", async ({ page }) => {
  await page.goto("/register");
  const id = Math.random().toString(36).slice(2, 7);
  await page.fill("#tenantName", `Doublon ${id}`);
  await page.fill("#name", "Gérant Doublon");
  await page.fill("#email", `cars-dbl-${id}@locarent.test`);
  await page.fill("#password", password);
  await page.fill("#passwordConfirmation", password);
  await page.getByRole("button", { name: "Créer mon agence" }).click();
  await expect(page).toHaveURL(/\/admin\/index$/);

  for (const n of [1, 2]) {
    await page.goto("/admin/cars/new");
    await page.fill("#name", `Véhicule ${n}`);
    await page.fill("#licensePlate", "SAME 001");
    await page.getByRole("button", { name: /Ajouter la tarification/ }).click();
    await page.fill("#dailyRate", "5000");
    await page.getByRole("button", { name: "Ajouter le véhicule" }).click();
    if (n === 1) {
      await expect(page).toHaveURL(/\/admin\/cars\/\d+$/, { timeout: 15000 });
    }
  }

  // Le message global nomme le champ, même si l'onglet affiché est
  // « Tarification » — c'est ce que voit l'utilisateur.
  await expect(
    page.getByRole("alert").filter({ hasText: "Champs à corriger" }),
  ).toContainText("Immatriculation");

  // Et l'erreur de champ est bien présente dans l'onglet Informations.
  await page.getByRole("button", { name: "Informations", exact: true }).click();
  await expect(page.getByText("Cette immatriculation existe déjà")).toBeVisible();
  await prisma.tenant.deleteMany({ where: { slug: { contains: id } } });
  await prisma.user.deleteMany({ where: { email: { contains: id } } });
});

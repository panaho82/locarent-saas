import "dotenv/config";
import { expect, test } from "@playwright/test";
import { prisma } from "../../src/server/db";

/**
 * Check-in client de bout en bout : photos, signature, contrat figé.
 *
 * Vérifie aussi la règle du contrat : il n'affiche **que le tarif appliqué**
 * (le prix négocié), jamais le prix catalogue.
 */

const runId = Math.random().toString(36).slice(2, 8);
const password = "motdepasse-checkin-1";

/** PNG 1×1 valide, suffisant pour le contrôle de type. */
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

test.afterAll(async () => {
  await prisma.tenant.deleteMany({ where: { slug: { contains: runId } } });
  await prisma.user.deleteMany({ where: { email: { contains: runId } } });
  await prisma.$disconnect();
});

test("le client fait son check-in et signe le contrat négocié", async ({ page }) => {
  await page.goto("/register");
  await page.fill("#tenantName", `Checkin ${runId}`);
  await page.fill("#name", "Gérant Checkin");
  await page.fill("#email", `checkin-${runId}@locarent.test`);
  await page.fill("#password", password);
  await page.fill("#passwordConfirmation", password);
  await page.getByRole("button", { name: "Créer mon agence" }).click();
  await expect(page).toHaveURL(/\/admin\/index$/);

  // Véhicule à 6 630 / jour.
  await page.goto("/admin/cars/new");
  await page.fill("#name", "Renault Kwid");
  await page.fill("#licensePlate", "276 969 P");
  await page.getByRole("button", { name: /Ajouter la tarification/ }).click();
  await page.fill("#dailyRate", "6630");
  await page.getByRole("button", { name: "Ajouter le véhicule" }).click();
  await expect(page).toHaveURL(/\/admin\/cars\/\d+$/, { timeout: 15000 });

  // Client.
  await page.goto("/admin/customers/new");
  await page.fill("#firstName", "Franck");
  await page.fill("#lastName", "Teriitaumihau");
  await page.getByRole("button", { name: "Ajouter le client" }).click();
  await expect(page).toHaveURL(/\/admin\/customers\/\d+$/, { timeout: 15000 });

  // Réservation de 2 jours, négociée à 11 000 (catalogue : 13 260).
  await page.goto("/admin/reservations/new");
  await page.selectOption("#customerId", { index: 1 });
  await page.selectOption("#vehicleId", { index: 1 });
  await page.fill("#startDate", "2027-01-10");
  await page.fill("#endDate", "2027-01-12");
  await page.locator('input[name="endTime"]').fill("08:00");
  await page.waitForTimeout(400);
  await page.fill("#negotiatedTotal", "11000");
  await page.getByRole("button", { name: "Enregistrer la réservation" }).click();
  await expect(page).toHaveURL(/\/admin\/reservations\/\d+$/, { timeout: 20000 });

  // Le contrat imprimable affiche le tarif négocié… et pas le catalogue.
  const bookingUrl = page.url();
  const bookingId = Number(bookingUrl.split("/").pop());
  // \`page.request\` partage les cookies de session du navigateur.
  const contract = await page.request.get(`/admin/reservations/${bookingId}/contract`);
  expect(contract.status()).toBe(200);
  // Les montants sont formatés avec une espace insécable fine : on normalise
  // avant de comparer, sinon l'assertion négative passerait à tort.
  const html = (await contract.text()).replace(/\u00a0/g, " ");
  expect(html).toContain("11 000");
  expect(html).not.toContain("13 260");
  expect(html).toContain("Contrat de location");

  // Le client ouvre son lien de check-in.
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    select: { checkInToken: true },
  });
  const token = booking!.checkInToken;

  await page.goto(`/check-in/${token}`);
  await expect(page.getByText("Check-in en ligne")).toBeVisible();
  await expect(page.getByText("11 000 XPF")).toBeVisible();

  // Quatre photos.
  const inputs = page.locator('input[type="file"]');
  for (let index = 0; index < 4; index += 1) {
    await inputs.nth(index).setInputFiles({
      name: `photo-${index}.png`,
      mimeType: "image/png",
      buffer: PNG,
    });
  }

  // Signature au doigt (souris).
  const canvas = page.locator("canvas");
  // Le canvas est sous la ligne de flottaison : sans défilement, les
  // coordonnées souris tombent hors du viewport et rien n'est dessiné.
  await canvas.scrollIntoViewIfNeeded();
  const box = (await canvas.boundingBox())!;
  await page.mouse.move(box.x + 30, box.y + 40);
  await page.mouse.down();
  await page.mouse.move(box.x + 150, box.y + 90, { steps: 8 });
  await page.mouse.move(box.x + 260, box.y + 50, { steps: 8 });
  await page.mouse.up();

  await page.fill("#signerName", "Franck Teriitaumihau");
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Finaliser le check-in" }).click();

  await expect(page.getByText("Check-in effectué")).toBeVisible({ timeout: 30000 });

  // En base : contrat signé, empreinte, photos et signature.
  const saved = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: { contracts: true, documents: true },
  });

  expect(saved!.checkInCompletedAt).not.toBeNull();
  expect(saved!.hasSignedContract).toBe(true);
  expect(saved!.contracts).toHaveLength(1);
  expect(saved!.contracts[0]!.pdfHash).toMatch(/^[0-9a-f]{64}$/);
  expect(saved!.contracts[0]!.signerName).toBe("Franck Teriitaumihau");
  expect(saved!.contracts[0]!.signatureImagePath).toContain("signatures/");
  expect(saved!.documents).toHaveLength(4);

  // Le contrat signé contient la signature et l'empreinte.
  const signed = await page.request.get(`/check-in/${token}/contract`);
  const signedHtml = (await signed.text()).replace(/\u00a0/g, " ");
  expect(signedHtml).toContain("Empreinte du contrat");
  expect(signedHtml).toContain("/api/files/signatures/");
  expect(signedHtml).not.toContain("13 260");
});

import "dotenv/config";
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { prisma } from "../../src/server/db";

/**
 * Accessibilité — garde-fou automatisé.
 *
 * La spec 07 relève explicitement les défauts de contraste du produit d'origine
 * (orange sur blanc, libellés gris clair) et demande de viser 4.5:1. Sans test,
 * la correction se perd au premier composant ajouté.
 *
 * On ne tolère aucune violation de gravité « serious » ou « critical ».
 */

const runId = Math.random().toString(36).slice(2, 8);

async function scan(page: Page, label: string) {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();

  const blocking = results.violations.filter(
    (v) => v.impact === "serious" || v.impact === "critical",
  );

  if (blocking.length > 0) {
    console.log(
      `\n[${label}] ${blocking.length} violation(s) :\n` +
        blocking
          .map(
            (v) =>
              `  · ${v.id} (${v.impact}) — ${v.help}\n` +
              v.nodes.slice(0, 3).map((n) => `      ${n.target.join(" ")}`).join("\n"),
          )
          .join("\n"),
    );
  }

  expect(
    blocking.map((v) => `${v.id}: ${v.nodes.length} nœud(s)`),
    `violations d'accessibilité sur ${label}`,
  ).toEqual([]);
}

test.afterAll(async () => {
  await prisma.tenant.deleteMany({ where: { slug: { contains: runId } } });
  await prisma.user.deleteMany({ where: { email: { contains: runId } } });
  await prisma.$disconnect();
});

test("pages publiques sans violation bloquante", async ({ page }) => {
  await page.goto("/login");
  await scan(page, "/login");

  await page.goto("/register");
  await scan(page, "/register");

  await page.goto("/forgot-password");
  await scan(page, "/forgot-password");
});

test("pages d'administration sans violation bloquante", async ({ page }) => {
  const email = `a11y-${runId}@locarent.test`;

  await page.goto("/register");
  await page.fill("#tenantName", `Agence ${runId}`);
  await page.fill("#name", "Audit Accessibilité");
  await page.fill("#email", email);
  await page.fill("#password", "motdepasse-a11y-1");
  await page.fill("#passwordConfirmation", "motdepasse-a11y-1");
  await page.getByRole("button", { name: "Créer mon agence" }).click();
  await expect(page).toHaveURL(/\/admin\/index$/);

  await scan(page, "/admin/index");

  await page.goto("/admin/settings/company");
  await scan(page, "/admin/settings/company");

  await page.goto("/admin/settings/team");
  await scan(page, "/admin/settings/team");
});

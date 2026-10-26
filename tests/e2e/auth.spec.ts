import "dotenv/config";
import { expect, test, type Page } from "@playwright/test";
import { prisma } from "../../src/server/db";

/**
 * Parcours réels du Lot 0, sur le build de production.
 *
 *  1. une agence s'inscrit et arrive sur un tableau de bord vide ;
 *  2. elle invite un membre, qui accepte et arrive à son tour ;
 *  3. le membre n'a pas accès aux écrans de son propriétaire ;
 *  4. un visiteur non connecté est renvoyé vers la connexion ;
 *  5. la sonde de santé répond.
 *
 * Chaque test crée ses propres comptes (suffixe unique) : ils sont supprimés à
 * la fin, et deux exécutions successives ne se marchent pas dessus.
 */

const runId = Math.random().toString(36).slice(2, 8);
const password = "motdepasse-e2e-1";

function unique(tag: string): string {
  return `${runId}-${tag}-${Math.random().toString(36).slice(2, 6)}`;
}

async function register(page: Page, email: string, agencyName: string) {
  await page.goto("/register");
  await page.fill("#tenantName", agencyName);
  await page.fill("#name", "Propriétaire E2E");
  await page.fill("#email", email);
  await page.fill("#password", password);
  await page.fill("#passwordConfirmation", password);
  await page.getByRole("button", { name: "Créer mon agence" }).click();
}

test.afterAll(async () => {
  // Tout ce que ces tests ont créé contient `runId`.
  await prisma.tenant.deleteMany({ where: { slug: { contains: runId } } });
  await prisma.user.deleteMany({ where: { email: { contains: runId } } });
  await prisma.$disconnect();
});

test("inscription : l'agence arrive sur un tableau de bord vide", async ({
  page,
}) => {
  const id = unique("signup");
  const agencyName = `Agence ${id}`;
  const email = `e2e-${id}@locarent.test`;

  await register(page, email, agencyName);

  await expect(page).toHaveURL(/\/admin\/index$/);
  await expect(
    page.getByRole("heading", { name: "Tableau de bord" }),
  ).toBeVisible();

  // Le nom de l'agence apparaît dans la barre latérale…
  await expect(
    page.getByText(agencyName, { exact: false }).first(),
  ).toBeVisible();
  // …et l'accueil est personnalisé.
  await expect(page.getByText("’Ia ora na, Propriétaire")).toBeVisible();

  // Cookie de session : httpOnly (invisible pour document.cookie).
  const cookies = await page.context().cookies();
  const session = cookies.find((c) => c.name === "locarent_session");
  expect(session).toBeDefined();
  expect(session?.httpOnly).toBe(true);
  expect(session?.sameSite).toBe("Lax");

  const jsVisible = await page.evaluate(() => document.cookie);
  expect(jsVisible).not.toContain("locarent_session");
});

test("invitation : le membre invité accepte et arrive dans l'agence", async ({
  page,
  browser,
}) => {
  const id = unique("invite");
  const agencyName = `Agence ${id}`;
  const ownerEmail = `e2e-owner-${id}@locarent.test`;
  const memberEmail = `e2e-member-${id}@locarent.test`;

  await register(page, ownerEmail, agencyName);
  await expect(page).toHaveURL(/\/admin\/index$/);

  await page.goto("/admin/settings/team");
  await page.fill("#invite-email", memberEmail);
  await page.getByRole("button", { name: "Envoyer l'invitation" }).click();

  // En développement, la Server Action renvoie le lien faute de transport email.
  // Next injecte un route-announcer avec role="alert" : filtrer sur le texte.
  const alert = page.getByRole("alert").filter({ hasText: "Invitation créée" });
  await expect(alert).toBeVisible();
  const text = await alert.innerText();
  const link = text.match(/https?:\/\/\S+/)?.[0];
  expect(link, `lien d'invitation introuvable dans : ${text}`).toBeTruthy();

  // Le membre ouvre le lien dans un navigateur vierge (aucune session).
  const memberContext = await browser.newContext();
  const memberPage = await memberContext.newPage();

  await memberPage.goto(link!);
  await expect(
    memberPage.getByRole("heading", { name: new RegExp(agencyName) }),
  ).toBeVisible();

  await memberPage.fill("#name", "Membre E2E");
  await memberPage.fill("#password", password);
  await memberPage.fill("#passwordConfirmation", password);
  await memberPage.getByRole("button", { name: "Rejoindre l'agence" }).click();

  await expect(memberPage).toHaveURL(/\/admin\/index$/);

  // Un membre sans `user.view` ne voit pas l'écran Équipe.
  await memberPage.goto("/admin/settings/team");
  await expect(memberPage.getByText("Accès non autorisé")).toBeVisible();

  await memberContext.close();
});

test("garde d'accès : un visiteur non connecté est renvoyé vers la connexion", async ({
  browser,
}) => {
  const context = await browser.newContext();
  const page = await context.newPage();

  await page.goto("/admin/index");
  await expect(page).toHaveURL(/\/login/);
  await expect(page.getByRole("heading", { name: "Connexion" })).toBeVisible();

  await context.close();
});

test("connexion et déconnexion avec un compte fraîchement créé", async ({
  page,
}) => {
  // Compte créé par le test lui-même : aucun parcours ne dépend du seed.
  const id = unique("login");
  const email = `e2e-${id}@locarent.test`;

  await register(page, email, `Agence ${id}`);
  await expect(page).toHaveURL(/\/admin\/index$/);

  await page.getByRole("button", { name: "Déconnexion" }).click();
  await expect(page).toHaveURL(/\/login/);

  // Après déconnexion, revenir sur /admin ne rouvre pas la session.
  await page.goto("/admin/index");
  await expect(page).toHaveURL(/\/login/);

  // Reconnexion avec les mêmes identifiants.
  await page.fill("#email", email);
  await page.fill("#password", password);
  await page.getByRole("button", { name: "Se connecter" }).click();
  await expect(page).toHaveURL(/\/admin\/index$/);
});

test("mauvais mot de passe : message générique, pas d'énumération", async ({
  page,
}) => {
  await page.goto("/login");
  await page.fill("#email", `inconnu-${runId}@locarent.test`);
  await page.fill("#password", "mauvais-mot-de-passe");
  await page.getByRole("button", { name: "Se connecter" }).click();

  await expect(
    page.getByRole("alert").filter({ hasText: "incorrect" }),
  ).toContainText("Adresse email ou mot de passe incorrect");
});

test("sonde de santé", async ({ request }) => {
  const response = await request.get("/api/health");
  expect(response.status()).toBe(200);
  const body = await response.json();
  expect(body.status).toBe("ok");
  expect(body.database).toBe("up");
});

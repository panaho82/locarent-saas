/**
 * Seed de développement — idempotent.
 *
 *   pnpm db:seed
 *
 * Contenu : les 3 plans tarifaires et les 12 couleurs du référentiel d'origine
 * (docs/schema.sql), une agence de démonstration avec son compte `owner`, et
 * quelques marques automobiles.
 *
 * Le mot de passe de démonstration est affiché à la fin : il ne vaut que pour
 * un environnement local.
 */

import "dotenv/config";
import { hashPassword } from "../src/server/auth/password";
import { prisma } from "../src/server/db";

const DEMO = {
  tenantSlug: "agence-demo",
  tenantName: "Agence Démo",
  email: "demo@locarent.test",
  password: "locarent-demo-1",
  ownerName: "Franck Teriitau",
};

const PLANS = [
  {
    slug: "basique",
    name: "Basique",
    monthlyPrice: 1990,
    yearlyPrice: 19900,
    maxVehicles: 3,
    maxLocations: 1,
    sortOrder: 1,
    hasExtraServices: false,
    hasMaintenance: false,
    hasAdvancedReports: false,
    hasTvaReport: false,
    hasAdvancedPricing: false,
    hasFullDashboard: false,
    hasRentalContracts: false,
    hasVehicleInspections: false,
    hasOnlineBooking: false,
  },
  {
    slug: "essentiel",
    name: "Essentiel",
    monthlyPrice: 4990,
    yearlyPrice: 49900,
    maxVehicles: 10,
    maxLocations: null,
    sortOrder: 2,
    hasExtraServices: false,
    hasMaintenance: true,
    hasAdvancedReports: false,
    hasTvaReport: false,
    hasAdvancedPricing: false,
    hasFullDashboard: true,
    hasRentalContracts: true,
    hasVehicleInspections: true,
    hasOnlineBooking: false,
  },
  {
    slug: "pro",
    name: "PRO",
    monthlyPrice: 7990,
    yearlyPrice: 79900,
    maxVehicles: null,
    maxLocations: null,
    sortOrder: 3,
    hasExtraServices: true,
    hasMaintenance: true,
    hasAdvancedReports: true,
    hasTvaReport: true,
    hasAdvancedPricing: true,
    hasFullDashboard: true,
    hasRentalContracts: true,
    hasVehicleInspections: true,
    hasOnlineBooking: true,
  },
] as const;

const COLORS = [
  ["white", "Blanc", "#FFFFFF"],
  ["black", "Noir", "#1a1a1a"],
  ["gray", "Gris", "#6B7280"],
  ["silver", "Argent", "#C0C0C0"],
  ["red", "Rouge", "#DC3545"],
  ["blue", "Bleu", "#0DCAF0"],
  ["green", "Vert", "#198754"],
  ["yellow", "Jaune", "#EAB308"],
  ["orange", "Orange", "#F97316"],
  ["brown", "Marron", "#92400E"],
  ["beige", "Beige", "#D9C3A5"],
  ["purple", "Violet", "#7C3AED"],
] as const;

/** Quelques marques pour le Lot 1 ; le catalogue complet (~380) sera importé. */
const BRANDS = [
  "Renault",
  "Dacia",
  "Peugeot",
  "Citroën",
  "Toyota",
  "Suzuki",
  "Nissan",
  "Hyundai",
  "Kia",
  "Ford",
  "Volkswagen",
  "Mitsubishi",
] as const;

function slugify(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

async function main() {
  console.log("→ plans");
  for (const plan of PLANS) {
    await prisma.plan.upsert({
      where: { slug: plan.slug },
      update: plan,
      create: plan,
    });
  }

  console.log("→ couleurs");
  for (const [slug, name, hex] of COLORS) {
    await prisma.color.upsert({
      where: { slug },
      update: { name, hex },
      create: { slug, name, hex },
    });
  }

  console.log("→ marques");
  for (const name of BRANDS) {
    const slug = slugify(name);
    await prisma.brand.upsert({
      where: { slug },
      update: { name },
      create: { name, slug },
    });
  }

  console.log(`→ agence de démonstration « ${DEMO.tenantName} »`);

  const tenant = await prisma.tenant.upsert({
    where: { slug: DEMO.tenantSlug },
    update: {},
    create: {
      slug: DEMO.tenantSlug,
      name: DEMO.tenantName,
      managerName: DEMO.ownerName,
      email: DEMO.email,
      phone: "+689 87 00 00 00",
      address: "Quai des Pêcheurs",
      city: "Uturoa",
      island: "Raiatea",
      country: "PF",
      timezone: "Pacific/Tahiti",
    },
  });

  await prisma.settings.upsert({
    where: { tenantId: tenant.id },
    update: {},
    create: {
      tenantId: tenant.id,
      companyTagline: "Location de véhicules à Raiatea",
      // TVA activée et 13 % : valeurs du contexte polynésien.
      tvaEnabled: true,
      defaultTaxRate: 13,
      defaultCurrency: "XPF",
      onlineBookingEnabled: false,
      primaryColor: "#FFA633",
    },
  });

  const password = await hashPassword(DEMO.password);
  const owner = await prisma.user.upsert({
    where: { tenantId_email: { tenantId: tenant.id, email: DEMO.email } },
    update: {},
    create: {
      tenantId: tenant.id,
      name: DEMO.ownerName,
      email: DEMO.email,
      password,
      role: "owner",
      isFounder: true,
      permissions: [],
    },
  });

  // Abonnement d'essai : 1 mois, plan PRO (comme le compte analysé).
  const existingSubscription = await prisma.subscription.findFirst({
    where: { tenantId: tenant.id },
  });
  if (!existingSubscription) {
    const pro = await prisma.plan.findUniqueOrThrow({ where: { slug: "pro" } });
    const start = new Date();
    const end = new Date(start);
    end.setMonth(end.getMonth() + 1);

    await prisma.subscription.create({
      data: {
        tenantId: tenant.id,
        planId: pro.id,
        status: "trial",
        billingPeriod: "monthly",
        currentPrice: pro.monthlyPrice,
        trialStartDate: start,
        trialEndDate: end,
        currentPeriodStart: start,
        currentPeriodEnd: end,
        nextRenewalDate: end,
      },
    });
  }

  const [plans, colors, brands, tenants] = await Promise.all([
    prisma.plan.count(),
    prisma.color.count(),
    prisma.brand.count(),
    prisma.tenant.count(),
  ]);

  console.log(
    `\n✔ Seed terminé — ${plans} plans, ${colors} couleurs, ${brands} marques, ${tenants} agence(s).`,
  );
  console.log(`  Compte de démonstration : ${DEMO.email} / ${DEMO.password}`);
  console.log(`  (utilisateur #${owner.id}, agence #${tenant.id})\n`);
}

main()
  .catch((error) => {
    console.error("✗ Seed interrompu :", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

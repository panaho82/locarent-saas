// Spike de l'étape 1 : prouve que la chaîne Next 16 + Prisma 7 (ESM, client
// généré hors node_modules, driver adapter pg) fonctionne réellement.
//
//   pnpm spike
//
// À supprimer une fois l'étape 2 terminée (remplacé par le seed et les tests).

import "dotenv/config";
import { prisma } from "../src/server/db";

async function main() {
  const plans = await prisma.plan.findMany({ orderBy: { sortOrder: "asc" } });
  console.log(`Connexion OK — ${plans.length} plan(s) en base.`);
  for (const p of plans) {
    console.log(`  · ${p.slug.padEnd(10)} ${p.monthlyPrice} XPF/mois`);
  }
}

main()
  .catch((e) => {
    console.error("Échec du spike :", e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

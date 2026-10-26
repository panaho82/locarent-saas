import "dotenv/config";

/**
 * Les tests d'intégration tapent la même base que le développement
 * (PostgreSQL local, port 55432). Ils créent leurs propres fixtures et les
 * suppriment à la fin — jamais de données de démonstration touchées.
 */

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL absente : les tests nécessitent une base Postgres (docker compose up -d postgres).",
  );
}

// Les tests ne doivent jamais s'exécuter contre une base de production.
if (process.env.NODE_ENV === "production") {
  throw new Error("Tests refusés en NODE_ENV=production.");
}

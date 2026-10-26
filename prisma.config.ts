import "dotenv/config";
import { defineConfig, env } from "prisma/config";

/**
 * Configuration Prisma 7.
 *
 * Depuis la v7, l'URL de connexion ne vit plus dans le bloc `datasource` du
 * schéma mais ici, et le client est généré hors de `node_modules` (voir
 * `generator client` dans prisma/schema.prisma).
 */
export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    url: env("DATABASE_URL"),
  },
});

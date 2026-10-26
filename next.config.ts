import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Image autonome pour Docker / Dokploy (Lot 0, étape 7).
  output: "standalone",
  poweredByHeader: false,
  // Tailwind 4 est chargé par Turbopack (chemin officiel du template Next 16) :
  // pas de postcss.config.mjs.
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;

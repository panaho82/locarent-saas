import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Image autonome pour Docker / Dokploy (voir Dockerfile).
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

  /**
   * En-têtes de sécurité.
   *
   * Pas de Content-Security-Policy stricte pour l'instant : Next injecte des
   * scripts inline et une CSP correcte exige des nonces générés par requête.
   * À traiter comme un durcissement dédié (avec rapport de violation), pas en
   * une ligne dans ce fichier.
   *
   * `camera=(self)` est volontaire : le check-in client photographie le permis
   * et la pièce d'identité depuis le navigateur (Lot 3).
   */
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          {
            key: "Permissions-Policy",
            value: "camera=(self), microphone=(), geolocation=()",
          },
          {
            key: "Strict-Transport-Security",
            value: "max-age=31536000; includeSubDomains",
          },
        ],
      },
    ];
  },
};

export default nextConfig;

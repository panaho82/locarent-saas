#!/usr/bin/env node
/**
 * Prévisualisation de production.
 *
 * `output: "standalone"` produit un serveur autonome (.next/standalone/server.js)
 * que `next start` ne sait pas servir. On reconstitue donc l'arborescence
 * attendue — c'est exactement ce que fait le Dockerfile, et donc ce qui sera
 * réellement exécuté en production.
 *
 *   pnpm preview        → http://localhost:3210
 */

import { cp, mkdir, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import { spawn } from "node:child_process";
import path from "node:path";

const root = process.cwd();
const standalone = path.join(root, ".next", "standalone");

if (!existsSync(path.join(standalone, "server.js"))) {
  console.error(
    "✗ .next/standalone/server.js introuvable. Lancez `pnpm build` d'abord.",
  );
  process.exit(1);
}

// Les fichiers statiques ne sont pas copiés automatiquement par Next.
await rm(path.join(standalone, ".next", "static"), {
  recursive: true,
  force: true,
});
await mkdir(path.join(standalone, ".next"), { recursive: true });
await cp(
  path.join(root, ".next", "static"),
  path.join(standalone, ".next", "static"),
  { recursive: true },
);

const publicDir = path.join(root, "public");
if (existsSync(publicDir)) {
  await cp(publicDir, path.join(standalone, "public"), { recursive: true });
}

const port = process.env.PORT ?? "3210";
console.log(`→ serveur standalone sur http://localhost:${port}`);

const child = spawn(process.execPath, [path.join(standalone, "server.js")], {
  stdio: "inherit",
  env: {
    ...process.env,
    NODE_ENV: "production",
    PORT: port,
    HOSTNAME: process.env.HOSTNAME ?? "127.0.0.1",
  },
});

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => child.kill(signal));
}

child.on("exit", (code) => process.exit(code ?? 0));

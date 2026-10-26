import { defineConfig, devices } from "@playwright/test";

/**
 * Tests end-to-end.
 *
 * Ils tournent contre le build de production (`next start`), pas le serveur de
 * développement : on veut vérifier ce qui sera déployé.
 */
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: [["list"]],
  use: {
    baseURL: "http://localhost:3210",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "pnpm preview",
    url: "http://localhost:3210/api/health",
    reuseExistingServer: true,
    timeout: 120_000,
  },
});

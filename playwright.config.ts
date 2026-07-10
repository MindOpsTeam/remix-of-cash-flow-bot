import { defineConfig, devices } from "@playwright/test";

/**
 * E2E contra o build de produção servido localmente (vite preview),
 * apontando para o Supabase real via .env. Os testes usam um tenant
 * de teste dedicado (E2E_EMAIL/E2E_PASSWORD) criado e destruído fora
 * da suíte — nunca tocam dados de clientes.
 */
export default defineConfig({
  testDir: "./e2e",
  timeout: 45_000,
  fullyParallel: false,
  retries: 1,
  reporter: [["list"]],
  use: {
    baseURL: "http://localhost:4173",
    screenshot: "only-on-failure",
    locale: "pt-BR",
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] }, grepInvert: /@mobile/ },
    { name: "mobile", use: { ...devices["iPhone 12"] }, grep: /@mobile/ },
  ],
  webServer: {
    command: "npm run build:dev >/dev/null 2>&1 && npx vite preview --port 4173 --strictPort",
    url: "http://localhost:4173",
    reuseExistingServer: true,
    timeout: 180_000,
  },
});

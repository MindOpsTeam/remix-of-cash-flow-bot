import { expect, test, type Page } from "@playwright/test";

const companyId = "11111111-1111-4111-8111-111111111111";
const userId = "22222222-2222-4222-8222-222222222222";

const protectedRoutes = [
  "/dashboard",
  "/transactions",
  "/transfers",
  "/receivables",
  "/contracts",
  "/bills",
  "/documents",
  "/owner-transactions",
  "/inter",
  "/contacts",
  "/products",
  "/sales",
  "/salespeople",
  "/purchases",
  "/stock",
  "/fiscal",
  "/fiscal/nfse/emit",
  "/fiscal/plugnotas/emit",
  "/fiscal/focus/emit",
  "/auditoria",
  "/fiscal/impostos",
  "/reforma",
  "/reforma/impacto",
  "/fiscal/contas-a-pagar",
  "/fiscal/arquivos",
  "/dre",
  "/reports",
  "/forecast",
  "/summary",
  "/cfo-digital",
  "/agents",
  "/close",
  "/budget",
  "/simulator",
  "/whatsapp",
  "/settings",
  "/settings/company",
  "/settings/consolidation",
  "/settings/api",
  "/settings/users",
  "/settings/bank-accounts",
  "/settings/chart-of-accounts",
  "/settings/cost-centers",
  "/settings/integrations",
  "/settings/integrations/asaas",
  "/settings/integrations/inter",
  "/settings/integrations/nfse",
  "/settings/integrations/plugnotas",
  "/settings/integrations/focus",
  "/settings/integrations/openfinance",
  "/settings/preferences",
] as const;

const headers = {
  "access-control-allow-origin": "http://localhost:4173",
  "access-control-allow-credentials": "true",
  "access-control-allow-headers": "apikey, authorization, content-profile, content-type, prefer, range, x-client-info",
  "access-control-allow-methods": "GET, POST, PATCH, PUT, DELETE, OPTIONS",
  "access-control-expose-headers": "content-range",
  "content-type": "application/json",
};

function base64Url(value: unknown) {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

function fakeSession() {
  const now = Math.floor(Date.now() / 1000);
  const iso = new Date(now * 1000).toISOString();
  const user = {
    id: userId,
    aud: "authenticated",
    role: "authenticated",
    email: "qa.visual@financeai.local",
    email_confirmed_at: iso,
    phone: "",
    confirmed_at: iso,
    last_sign_in_at: iso,
    app_metadata: { provider: "email", providers: ["email"] },
    user_metadata: { full_name: "Operador Financeiro" },
    identities: [],
    created_at: iso,
    updated_at: iso,
    is_anonymous: false,
  };
  const accessToken = [
    base64Url({ alg: "HS256", typ: "JWT" }),
    base64Url({ aud: "authenticated", exp: now + 3600, iat: now, sub: userId, role: "authenticated" }),
    "route-audit",
  ].join(".");

  return {
    access_token: accessToken,
    token_type: "bearer",
    expires_in: 3600,
    expires_at: now + 3600,
    refresh_token: "route-audit-refresh",
    user,
  };
}

async function installMocks(page: Page) {
  const session = fakeSession();

  await page.route("**/auth/v1/**", async (route) => {
    if (route.request().method() === "OPTIONS") {
      await route.fulfill({ status: 204, headers });
      return;
    }
    if (route.request().url().includes("/token")) {
      await route.fulfill({ status: 200, headers, body: JSON.stringify(session) });
      return;
    }
    if (route.request().url().includes("/user")) {
      await route.fulfill({ status: 200, headers, body: JSON.stringify(session.user) });
      return;
    }
    await route.fulfill({ status: 200, headers, body: "{}" });
  });

  await page.route("**/rest/v1/**", async (route) => {
    if (route.request().method() === "OPTIONS") {
      await route.fulfill({ status: 204, headers });
      return;
    }

    const url = new URL(route.request().url());
    const table = url.pathname.split("/").at(-1);
    const wantsObject = (route.request().headers().accept ?? "").includes("application/vnd.pgrst.object");
    let body: unknown = [];

    if (table === "company_members" && (url.searchParams.get("select") ?? "").includes("companies")) {
      body = [{
        company_id: companyId,
        companies: {
          id: companyId,
          name: "Acme Holdings Brasil S.A.",
          cnpj: "12345678000199",
          org_id: "ACME-MATRIZ",
          regime_tributario: "regular",
          cclasstrib_padrao: "000001",
        },
      }];
    } else if (table === "company_members" && wantsObject) {
      body = {
        id: "33333333-3333-4333-8333-333333333333",
        onboarding_completed: true,
        approval_limit: null,
        role: "admin",
      };
    } else if (table === "v_group_ap_ar") {
      body = [{
        company_id: companyId,
        ap_a_vencer: 418400,
        ap_vencido: 28400,
        ar_a_vencer: 612800,
        ar_vencido: 45200,
      }];
    }

    await route.fulfill({
      status: 200,
      headers: { ...headers, "content-range": "0-0/*" },
      body: JSON.stringify(body),
    });
  });

  await page.route("**/functions/v1/**", async (route) => {
    await route.fulfill({ status: 200, headers, body: "{}" });
  });
}

async function loginWithMocks(page: Page) {
  await installMocks(page);
  await page.goto("/");
  const form = page.getByRole("form", { name: "Entrar no FinanceAI" });
  await form.getByLabel("Email").fill("qa.visual@financeai.local");
  await form.getByLabel("Senha").fill("route-audit");
  await form.getByRole("button", { name: "Entrar no FinanceAI" }).click();
  await expect(page.getByRole("heading", { name: "Painel Consolidado" })).toBeVisible();
}

test.describe("migração integral do design system", () => {
  test("tokens, fontes, tema e assets oficiais estão ativos", async ({ page, request }) => {
    await page.goto("/");
    await expect(page.getByRole("form", { name: "Entrar no FinanceAI" })).toBeVisible();

    const theme = await page.evaluate(() => ({
      mode: document.documentElement.dataset.theme,
      navy: getComputedStyle(document.documentElement).getPropertyValue("--via-navy").trim(),
      font: getComputedStyle(document.body).fontFamily,
    }));
    expect(theme.mode).toBe("light");
    expect(theme.navy.toUpperCase()).toBe("#0A1F3B");
    expect(theme.font).toContain("Geist");

    await page.evaluate(() => document.fonts.ready);
    const fontAudit = await page.evaluate(() => {
      const resources = performance.getEntriesByType("resource").map((entry) => entry.name);
      return {
        geist: document.fonts.check("16px Geist"),
        localResources: resources.filter((name) => name.endsWith(".woff2")),
        externalGoogle: resources.some((name) => /fonts\.(googleapis|gstatic)\.com/.test(name)),
      };
    });
    expect(fontAudit.geist).toBe(true);
    expect(fontAudit.localResources.some((name) => name.includes("Geist-Variable"))).toBe(true);
    expect(fontAudit.externalGoogle).toBe(false);

    for (const { path, size } of [
      { path: "/favicon-via.png" },
      { path: "/favicon-via.ico" },
      { path: "/icon-via-192.png", size: 192 },
      { path: "/icon-via-512.png", size: 512 },
      { path: "/apple-touch-icon-via.png", size: 180 },
      { path: "/brand/viver-de-ia/VIA_app_icon.png" },
      { path: "/brand/viver-de-ia/VIA_white.png" },
    ]) {
      const response = await request.get(path);
      expect(response.ok(), `asset ausente: ${path}`).toBe(true);
      expect(response.headers()["content-type"], `asset inválido: ${path}`).toContain("image/");
      if (size) {
        const png = await response.body();
        expect(png.readUInt32BE(16), `largura inválida: ${path}`).toBe(size);
        expect(png.readUInt32BE(20), `altura inválida: ${path}`).toBe(size);
      }
    }

    await page.getByRole("button", { name: "Ativar tema escuro" }).click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  });

  test("as 51 rotas protegidas montam sem crash ou overflow horizontal", async ({ page }) => {
    const pageErrors: string[] = [];
    page.on("pageerror", (error) => pageErrors.push(error.message));
    await loginWithMocks(page);
    expect(protectedRoutes).toHaveLength(51);

    for (const route of protectedRoutes) {
      await page.goto(route, { waitUntil: "domcontentloaded" });
      await expect(page.locator("#financeai-main"), `main ausente em ${route}`).toBeVisible();
      await page.waitForTimeout(100);

      const result = await page.evaluate(() => ({
        overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        mainText: document.querySelector("#financeai-main")?.textContent?.trim().length ?? 0,
      }));
      expect(result.mainText, `conteúdo vazio em ${route}`).toBeGreaterThan(0);
      expect(result.overflow, `overflow em ${route}`).toBeLessThanOrEqual(1);
    }

    expect(pageErrors).toEqual([]);
  });

  test("as 51 rotas protegidas preservam o viewport @mobile", async ({ page }) => {
    const pageErrors: string[] = [];
    page.on("pageerror", (error) => pageErrors.push(error.message));
    await loginWithMocks(page);

    for (const route of protectedRoutes) {
      await page.goto(route, { waitUntil: "domcontentloaded" });
      await expect(page.locator("#financeai-main"), `main ausente em ${route}`).toBeVisible();
      await page.waitForTimeout(100);

      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow, `overflow mobile em ${route}`).toBeLessThanOrEqual(1);
    }

    expect(pageErrors).toEqual([]);
  });
});

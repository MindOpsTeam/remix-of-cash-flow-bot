#!/usr/bin/env node

/**
 * QA visual sem mutação externa.
 *
 * Intercepta Auth/REST do Supabase dentro do Playwright e injeta um tenant
 * determinístico só no navegador. Nenhum usuário, CNPJ ou lançamento é criado.
 *
 * Pré-requisito: app servido em QA_BASE_URL (default http://127.0.0.1:4173).
 */

import { mkdir } from "node:fs/promises";
import { chromium } from "@playwright/test";

const baseURL = process.env.QA_BASE_URL ?? "http://127.0.0.1:4173";
const qaOrigin = new URL(baseURL).origin;
const outputDir = new URL("../artifacts/design-system/", import.meta.url);
const companyId = "11111111-1111-4111-8111-111111111111";
const userId = "22222222-2222-4222-8222-222222222222";

function base64Url(value) {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

function fakeSession() {
  const now = Math.floor(Date.now() / 1000);
  const accessToken = [
    base64Url({ alg: "HS256", typ: "JWT" }),
    base64Url({ aud: "authenticated", exp: now + 3600, iat: now, sub: userId, role: "authenticated" }),
    "visual-qa",
  ].join(".");
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
  return {
    access_token: accessToken,
    token_type: "bearer",
    expires_in: 3600,
    expires_at: now + 3600,
    refresh_token: "visual-qa-refresh",
    user,
  };
}

function monthRows() {
  const rows = [];
  const current = new Date();
  for (let offset = 11; offset >= 0; offset -= 1) {
    const date = new Date(current.getFullYear(), current.getMonth() - offset, 1);
    const factor = 12 - offset;
    rows.push({
      company_id: companyId,
      month: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-01`,
      receita: 780000 + factor * 42000,
      custos: 318000 + factor * 14000,
      despesas: 228000 + factor * 9000,
    });
  }
  return rows;
}

const headers = {
  "access-control-allow-origin": qaOrigin,
  "access-control-allow-credentials": "true",
  "access-control-allow-headers": "apikey, authorization, content-profile, content-type, prefer, range, x-client-info",
  "access-control-allow-methods": "GET, POST, PATCH, PUT, DELETE, OPTIONS",
  "access-control-expose-headers": "content-range",
  "content-type": "application/json",
};

async function installMocks(page) {
  const session = fakeSession();
  const margins = monthRows();

  await page.route("**/auth/v1/**", async (route) => {
    const request = route.request();
    if (request.method() === "OPTIONS") {
      await route.fulfill({ status: 204, headers });
      return;
    }
    if (request.url().includes("/token")) {
      await route.fulfill({ status: 200, headers, body: JSON.stringify(session) });
      return;
    }
    if (request.url().includes("/user")) {
      await route.fulfill({ status: 200, headers, body: JSON.stringify(session.user) });
      return;
    }
    await route.fulfill({ status: 200, headers, body: "{}" });
  });

  await page.route("**/rest/v1/**", async (route) => {
    const request = route.request();
    if (request.method() === "OPTIONS") {
      await route.fulfill({ status: 204, headers });
      return;
    }

    const url = new URL(request.url());
    const table = url.pathname.split("/").at(-1);
    const wantsObject = (request.headers().accept ?? "").includes("application/vnd.pgrst.object");
    let body = [];

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
    } else if (table === "v_company_margin") {
      const monthFilter = url.searchParams.get("month");
      body = monthFilter ? margins.filter((row) => monthFilter.includes(row.month)) : margins;
    } else if (table === "v_group_ap_ar") {
      body = [{
        company_id: companyId,
        ap_a_vencer: 418400,
        ap_vencido: 28400,
        ar_a_vencer: 612800,
        ar_vencido: 45200,
      }];
    } else if (table === "budgets") {
      body = [{ receita: 1260000, custos: 452000, despesas: 318000 }];
    }

    await route.fulfill({
      status: 200,
      headers: { ...headers, "content-range": "0-0/*" },
      body: JSON.stringify(body),
    });
  });
}

async function createPage(browser, variant) {
  const context = await browser.newContext({
    viewport: { width: variant.width, height: variant.height },
    deviceScaleFactor: 1,
    locale: "pt-BR",
    reducedMotion: "no-preference",
  });
  const page = await context.newPage();
  return { context, page };
}

async function screenshot(page, variant) {
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(1200);

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  const path = new URL(`${variant.name}.png`, outputDir);
  await page.screenshot({ path: path.pathname, fullPage: true });
  return { name: variant.name, overflow, path: path.pathname };
}

async function captureLogin(browser, variant) {
  const { context, page } = await createPage(browser, variant);
  await page.goto(baseURL, { waitUntil: "domcontentloaded" });
  await page.getByRole("form", { name: "Entrar no FinanceAI" }).waitFor({ timeout: 15_000 });

  if (variant.dark) {
    await page.getByRole("button", { name: "Ativar tema escuro" }).click();
  }

  const result = await screenshot(page, variant);
  await context.close();
  return result;
}

async function captureDashboard(browser, variant) {
  const { context, page } = await createPage(browser, variant);
  await installMocks(page);
  await page.goto(baseURL, { waitUntil: "domcontentloaded" });
  await page.getByRole("form", { name: "Entrar no FinanceAI" }).getByLabel("Email").fill("qa.visual@financeai.local");
  await page.getByRole("form", { name: "Entrar no FinanceAI" }).getByLabel("Senha").fill("visual-qa");
  await page.getByRole("button", { name: "Entrar no FinanceAI" }).click();
  await page.getByRole("heading", { name: "Painel Consolidado" }).waitFor({ timeout: 15_000 });

  if (variant.dark) {
    await page.getByRole("button", { name: "Ativar tema escuro" }).click();
  }

  const result = await screenshot(page, variant);
  await context.close();
  return result;
}

await mkdir(outputDir, { recursive: true });
const browser = await chromium.launch({ headless: true });
const results = [];
for (const variant of [
  { name: "login-desktop-light", width: 1440, height: 1000, dark: false },
  { name: "login-desktop-dark", width: 1440, height: 1000, dark: true },
  { name: "login-mobile-light", width: 390, height: 844, dark: false },
]) {
  results.push(await captureLogin(browser, variant));
}
for (const variant of [
  { name: "dashboard-desktop-light", width: 1440, height: 1100, dark: false },
  { name: "dashboard-desktop-dark", width: 1440, height: 1100, dark: true },
  { name: "dashboard-mobile-light", width: 390, height: 844, dark: false },
]) {
  results.push(await captureDashboard(browser, variant));
}
await browser.close();

console.log(JSON.stringify(results, null, 2));

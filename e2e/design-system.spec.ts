import { expect, test, type Page } from "@playwright/test";

const companyId = "11111111-1111-4111-8111-111111111111";
const secondCompanyId = "44444444-4444-4444-8444-444444444444";
const thirdCompanyId = "55555555-5555-4555-8555-555555555555";
const userId = "22222222-2222-4222-8222-222222222222";

const protectedRoutes = [
  "/dashboard",
  "/transactions",
  "/bank-inbox",
  "/pdv",
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
  "/consolidado",
  "/recorrencia",
  "/contador",
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
  "/settings/plataforma",
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

function fakeSession(email = "qa.visual@financeai.local") {
  const now = Math.floor(Date.now() / 1000);
  const iso = new Date(now * 1000).toISOString();
  const user = {
    id: userId,
    aud: "authenticated",
    role: "authenticated",
    email,
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

function mockMarginRows() {
  const companies = [
    { id: companyId, receita: 232_000, custos: 92_000, despesas: 61_000 },
    { id: secondCompanyId, receita: 168_000, custos: 81_000, despesas: 49_000 },
    { id: thirdCompanyId, receita: 104_000, custos: 58_000, despesas: 54_000 },
  ];

  return Array.from({ length: 12 }, (_, monthIndex) => {
    const date = new Date();
    date.setDate(1);
    date.setMonth(date.getMonth() - (11 - monthIndex));
    const month = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-01`;
    const seasonality = 0.84 + monthIndex * 0.018 + Math.sin(monthIndex * 1.2) * 0.045;

    return companies.map((company, companyIndex) => ({
      company_id: company.id,
      month,
      receita: Math.round(company.receita * seasonality),
      custos: Math.round(company.custos * (seasonality + companyIndex * 0.015)),
      despesas: Math.round(company.despesas * (0.97 + Math.cos(monthIndex) * 0.035)),
    }));
  }).flat();
}

interface MockOptions {
  marginRows?: ReturnType<typeof mockMarginRows>;
  onboardingIncompleto?: boolean;
  demoUser?: boolean;
  /** Simula o banco original do template (cadastro bloqueado). */
  modoTemplate?: boolean;
  /** Simula um REMIX: a vitrine veio por clonagem e não pertence a este banco. */
  semDemonstracao?: boolean;
  /** Instalação já tem dono: novos usuários entram só por convite. */
  cadastroPorConvite?: boolean;
  bankRaw?: Array<{ id: string; date: string; description: string; amount: number; direction: string }>;
  bankConnections?: Array<{ id: string; provider: string; external_id: string; institution_name: string; institution_image: null; status: string; last_synced_at: string | null; consent_expires_at: null }>;
}

async function installMocks(page: Page, options: MockOptions = {}) {
  const session = fakeSession(options.demoUser ? "demo@financeai.app" : undefined);
  const marginRows = options.marginRows ?? mockMarginRows();

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
      body = [
        {
          company_id: companyId,
          companies: {
            id: companyId,
            name: "Acme Holdings Brasil S.A.",
            cnpj: "12345678000199",
            org_id: "ACME-MATRIZ",
            regime_tributario: "regular",
            cclasstrib_padrao: "000001",
          },
        },
        {
          company_id: secondCompanyId,
          companies: {
            id: secondCompanyId,
            name: "Acme Serviços Digitais",
            cnpj: "23456789000155",
            org_id: "ACME-DIGITAL",
            regime_tributario: "regular",
            cclasstrib_padrao: "000001",
          },
        },
        {
          company_id: thirdCompanyId,
          companies: {
            id: thirdCompanyId,
            name: "Acme Operações",
            cnpj: "34567890000144",
            org_id: "ACME-OPS",
            regime_tributario: "simples",
            cclasstrib_padrao: "000001",
          },
        },
      ];
    } else if (table === "company_members") {
      // maybeSingle pede como LISTA (sem o accept de objeto) e pega a 1ª linha.
      const membro = {
        id: "33333333-3333-4333-8333-333333333333",
        user_id: userId,
        company_id: companyId,
        onboarding_completed: !options.onboardingIncompleto,
        approval_limit: null,
        role: "admin",
        created_at: "2026-07-01T12:00:00Z",
      };
      body = wantsObject ? membro : [membro];
    } else if (table === "v_group_ap_ar") {
      body = [{
        company_id: companyId,
        ap_a_vencer: 418400,
        ap_vencido: 28400,
        ar_a_vencer: 612800,
        ar_vencido: 45200,
      }];
    } else if (table === "v_company_margin") {
      body = marginRows;
    } else if (table === "v_group_account_totals") {
      body = [
        { company_id: companyId, month: "2026-07-01", group_code: "3.1", group_name: "Receita de Serviços", type: "revenue", total: 120000 },
        { company_id: secondCompanyId, month: "2026-07-01", group_code: "3.1", group_name: "Receita de Serviços", type: "revenue", total: 80000 },
        { company_id: companyId, month: "2026-07-01", group_code: "4.1", group_name: "CMV", type: "expense", total: 30000 },
        { company_id: thirdCompanyId, month: "2026-07-01", group_code: "5.1", group_name: "Administrativas", type: "expense", total: 12000 },
      ];
    } else if (table === "company_journal_entries") {
      body = [
        { id: "j1", transaction_id: "t1", date: "2026-07-10", debit_account: "Caixa", credit_account: "Receita de Serviços", amount: 1200, description: "Venda" },
      ];
    } else if (table === "bank_transactions_raw") {
      body = options.bankRaw ?? [];
    } else if (table === "bank_connections") {
      body = options.bankConnections ?? [];
    } else if (table === "user_preferences") {
      body = wantsObject
        ? { prefs: { favoritos: ["/dre"] } }
        : [{ prefs: { favoritos: ["/dre"] } }];
    } else if (table === "products") {
      body = [
        { id: "ddddddd1-0000-4000-8000-000000000001", name: "Café Especial 250g", sku: "CAFE-250", barcode: "789100000001", sell_price: 42, track_stock: true, current_stock: 12, type: "product" },
        { id: "ddddddd2-0000-4000-8000-000000000002", name: "Caneca Logo", sku: "CAN-01", barcode: "789100000002", sell_price: 35, track_stock: true, current_stock: 5, type: "product" },
      ];
    } else if (table === "chart_of_accounts") {
      body = [
        { id: "aaaaaaa1-0000-4000-8000-000000000001", name: "Receita de Serviços", code: "3.1", type: "revenue" },
        { id: "aaaaaaa2-0000-4000-8000-000000000002", name: "Despesas Administrativas", code: "5.1", type: "expense" },
      ];
    } else if (table === "receivables") {
      body = [
        { id: "cccc0001-0000-4000-8000-000000000001", description: "Fatura mensal · Horizonte", amount: 4800, due_date: "2026-08-10", status: "a_receber", source: "contrato", payment_date: null, parcela: 1, parcelas_total: 3, boleto_url: null, pix_url: null, external_id: null, created_at: "2026-07-02T10:15:00Z", updated_at: null, contact_id: "dddd0001-0000-4000-8000-000000000001", transaction_id: null, contract_id: "eeee0001-0000-4000-8000-000000000001", sales_order_id: null, contacts: { name: "Comercial Horizonte Ltda" } },
      ];
    } else if (table === "autores_da_empresa") {
      body = [{ user_id: userId, nome: "Operador Financeiro", email: "qa.visual@financeai.local", papel: "admin" }];
    } else if (table === "plataforma_bloqueada") {
      body = options.modoTemplate === true;
    } else if (table === "sou_dono_da_plataforma") {
      body = false;
    } else if (table === "demonstracao_disponivel") {
      // A vitrine só é oferecida no banco de origem. Num remix esta RPC responde
      // false e o botão tem que sumir da tela.
      body = options.semDemonstracao !== true;
    } else if (table === "cadastro_esta_aberto") {
      body = options.cadastroPorConvite !== true;
    } else if (table === "limpar_demonstracao_se_remixado") {
      body = { removida: false, motivo: "a vitrine deste banco é daqui" };
    } else if (table === "v_mrr_movimentos") {
      body = Array.from({ length: 12 }, (_, k) => {
        const d = new Date();
        d.setDate(1);
        d.setMonth(d.getMonth() - (11 - k));
        return {
          company_id: companyId,
          mes: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`,
          mrr_ativo: 12000 + k * 800,
          mrr_novo: k === 11 ? 900 : 400,
          mrr_perdido: k === 11 ? 300 : 0,
          contratos_novos: 1,
          contratos_perdidos: k === 11 ? 1 : 0,
        };
      });
    } else if (table === "v_recompra_clientes") {
      body = [
        { contact_id: "eeee0001-0000-4000-8000-000000000001", company_id: companyId, name: "Padaria Aurora", whatsapp: "11987654321", n_compras: 5, primeira_compra: "2026-02-01", ultima_compra: "2026-07-05", total_gasto: 9000, ticket_medio: 1800, intervalo_medio_dias: 30, dias_desde_ultima: 26, proxima_esperada: "2026-08-04", tem_contrato: false, status: "previsto" },
        { contact_id: "eeee0002-0000-4000-8000-000000000002", company_id: companyId, name: "Comercial Horizonte Ltda", whatsapp: null, n_compras: 6, primeira_compra: "2026-01-01", ultima_compra: "2026-06-21", total_gasto: 15000, ticket_medio: 2500, intervalo_medio_dias: 30, dias_desde_ultima: 40, proxima_esperada: "2026-07-21", tem_contrato: true, status: "atrasado" },
        { contact_id: "eeee0003-0000-4000-8000-000000000003", company_id: companyId, name: "Mercado Sol", whatsapp: null, n_compras: 4, primeira_compra: "2025-09-01", ultima_compra: "2026-01-10", total_gasto: 3200, ticket_medio: 800, intervalo_medio_dias: 45, dias_desde_ultima: 190, proxima_esperada: "2026-02-24", tem_contrato: false, status: "perdido" },
      ];
    }

    const total = Array.isArray(body) ? body.length : 1;
    await route.fulfill({
      status: 200,
      headers: { ...headers, "content-range": total > 0 ? `0-${total - 1}/${total}` : "*/0" },
      body: JSON.stringify(body),
    });
  });

  await page.route("**/functions/v1/**", async (route) => {
    const url = route.request().url();
    if (url.includes("classificar-lote")) {
      const req = route.request().postDataJSON() as { itens?: Array<{ tipo: string }> };
      const itens = (req.itens ?? []).map((item, indice) => ({
        indice,
        account_id: item.tipo === "revenue"
          ? "aaaaaaa1-0000-4000-8000-000000000001"
          : "aaaaaaa2-0000-4000-8000-000000000002",
        cost_center_id: null,
        confidence: "high",
        origem: "regra",
      }));
      await route.fulfill({
        status: 200,
        headers,
        body: JSON.stringify({ itens, resumo: { por_regra: itens.length, por_ia: 0, sem_classificacao: 0 } }),
      });
      return;
    }
    if (url.includes("openfinance-sync")) {
      const req = route.request().postDataJSON() as { action?: string; items?: unknown[] };
      if (req.action === "import") {
        await route.fulfill({
          status: 200,
          headers,
          body: JSON.stringify({ ok: true, imported: req.items?.length ?? 0, reconciled: 0, skipped: 0 }),
        });
        return;
      }
    }
    await route.fulfill({ status: 200, headers, body: "{}" });
  });
}

async function loginWithMocks(page: Page, options?: MockOptions) {
  await installMocks(page, options);
  await page.goto("/");
  const form = page.getByRole("form", { name: "Entrar no FinanceAI" });
  await form.getByLabel("Email").fill("qa.visual@financeai.local");
  await form.getByLabel("Senha").fill("route-audit");
  await form.getByRole("button", { name: "Entrar no FinanceAI" }).click();
  // Onboarding incompleto abre o wizard como modal e marca o fundo com
  // aria-hidden — o heading do dashboard sai da árvore de acessibilidade.
  // Esperar o marco certo em cada caso.
  const marco = options?.onboardingIncompleto ? "Bem-vindo" : "Painel Consolidado";
  await expect(page.getByRole("heading", { name: marco })).toBeVisible();
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

  test("as 57 rotas protegidas montam sem crash ou overflow horizontal", async ({ page }) => {
    const pageErrors: string[] = [];
    page.on("pageerror", (error) => pageErrors.push(error.message));
    await loginWithMocks(page);
    expect(protectedRoutes).toHaveLength(57);

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

    // page.goto derruba requests em voo (sino/prefs consultam em toda rota) e
    // o WebKit/Chromium reporta o abort como pageerror. Navegação real é
    // client-side e não aborta nada; filtramos só esse ruído.
    const ruidoDeNavegacao = /due to access control checks|Load failed|cancelled|aborted|NetworkError/i;
    expect(pageErrors.filter((e) => !ruidoDeNavegacao.test(e))).toEqual([]);
  });

  test("a navegação lateral permanece visível durante a rolagem", async ({ page }) => {
    await loginWithMocks(page);
    const sidebar = page.getByRole("complementary", { name: "Navegação principal" });

    await expect(sidebar).toBeVisible();
    await expect(sidebar).toHaveCSS("position", "sticky");
    const sidebarColor = await sidebar.evaluate((element) => getComputedStyle(element).backgroundColor);
    const rgb = sidebarColor.match(/\d+(?:\.\d+)?/g)?.slice(0, 3).map(Number) ?? [255, 255, 255];
    expect(Math.max(...rgb), "sidebar deveria usar uma superfície escura no tema claro").toBeLessThan(80);
    await expect(sidebar.locator('img[alt="Viver de IA"]')).toHaveAttribute("src", /app-icon-white/);

    const initialBox = await sidebar.boundingBox();
    expect(initialBox?.y).toBe(0);

    await page.evaluate(() => window.scrollTo(0, 600));
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(0);

    const scrolledBox = await sidebar.boundingBox();
    expect(scrolledBox?.y).toBe(0);
    expect(scrolledBox?.height).toBe(page.viewportSize()?.height);
  });

  test("a sidebar marca só o item mais específico como ativo", async ({ page }) => {
    await loginWithMocks(page);
    await page.goto("/fiscal/arquivos");
    const sidebar = page.getByRole("complementary", { name: "Navegação principal" });

    // "/fiscal/arquivos" é o único ativo; "/fiscal" (Notas Fiscais) não acende.
    await expect(sidebar.getByRole("link", { name: "Arquivos Fiscais" })).toHaveAttribute("aria-current", "page");
    await expect(sidebar.getByRole("link", { name: "Notas Fiscais" })).not.toHaveAttribute("aria-current", "page");
    // No máximo um item marcado como página atual na navegação inteira.
    await expect(sidebar.locator('[aria-current="page"]')).toHaveCount(1);
  });

  test("o painel troca a janela de período (mês / intervalo / ano)", async ({ page }) => {
    await loginWithMocks(page);
    await expect(page.getByRole("heading", { name: "Indicadores essenciais" })).toBeVisible();

    // Padrão: mês, comparação com o mês anterior.
    await expect(page.getByText("Comparação: vs mês anterior")).toBeVisible();

    // Ano: acumulado, sem base de comparação.
    await page.getByRole("tab", { name: "Ano" }).click();
    await expect(page.getByText("Comparação: acumulado do ano")).toBeVisible();
    await expect(page.getByText("Sem base de comparação").first()).toBeVisible();

    // Intervalo: mostra os dois seletores de mês.
    await page.getByRole("tab", { name: "Intervalo" }).click();
    await expect(page.getByLabel("Mês inicial")).toBeVisible();
    await expect(page.getByLabel("Mês final")).toBeVisible();
  });

  test("a navegação preenche a altura e a alça não rouba espaço", async ({ page }) => {
    await page.setViewportSize({ width: 1309, height: 780 });
    await loginWithMocks(page);
    // Regressão: `.via-sidebar > *` forçava position:relative na alça de
    // resize, jogando-a no fluxo e zerando a altura da nav (flex-1).
    const alturas = await page.evaluate(() => {
      const aside = document.querySelector('aside[aria-label="Navegação principal"]') as HTMLElement;
      const nav = aside.querySelector("nav") as HTMLElement;
      const resizer = aside.querySelector('[aria-label="Redimensionar menu"]') as HTMLElement;
      return {
        nav: Math.round(nav.getBoundingClientRect().height),
        resizerPos: getComputedStyle(resizer).position,
      };
    });
    expect(alturas.resizerPos).toBe("absolute");
    expect(alturas.nav).toBeGreaterThan(300);
  });

  test("a página de recorrência mostra MRR e o radar de recompra", async ({ page }) => {
    await loginWithMocks(page);
    await page.goto("/recorrencia");

    await expect(page.getByRole("heading", { name: "Recorrência & Recompra" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Saúde do MRR" })).toBeVisible();
    // Radar: clientes por status de recompra.
    await expect(page.getByText("Comprar agora").first()).toBeVisible();
    await expect(page.getByText("Padaria Aurora")).toBeVisible();
    await expect(page.getByText("Comercial Horizonte Ltda")).toBeVisible();
  });

  test("o dropdown de perfil cobre a navegação e as configurações usam grade de 3", async ({ page }) => {
    await loginWithMocks(page);
    // Regressão: `.via-sidebar > *` dá z-index:1 a cada filho; sem elevar o
    // contexto do seletor, a <nav> empilhava por cima e o menu parecia "sem fundo".
    await page.getByRole("button", { name: /Perfil/ }).click();
    const wrapper = page.locator(".via-persona-wrapper");
    await expect(wrapper).toHaveCSS("z-index", "40");
    await expect(page.getByText("visão e decisão")).toBeVisible();

    await page.goto("/settings");
    const grade = page.locator("main div.grid").first();
    await expect(grade).toHaveClass(/lg:grid-cols-3/);
    // Cards da mesma linha têm exatamente a mesma altura.
    const alturas = await grade.locator("> a > div").evaluateAll((els) =>
      els.slice(0, 3).map((el) => Math.round(el.getBoundingClientRect().height)),
    );
    expect(new Set(alturas).size).toBe(1);
  });

  test("o lembrete de concluir configuração é discreto e some quando completa", async ({ page }) => {
    await loginWithMocks(page);
    // Sem integração configurada (mocks vazios) o lembrete aparece no topo...
    const lembrete = page.getByRole("link", { name: /Concluir configuração/ });
    await expect(lembrete).toBeVisible();
    await expect(lembrete).toHaveAttribute("href", "/settings/plataforma");
    // ...e é discreto: não é modal nem banner, é um link pequeno no cabeçalho.
    const caixa = await lembrete.boundingBox();
    expect(caixa?.height ?? 99).toBeLessThan(32);
    expect(caixa?.y ?? 99).toBeLessThan(80);
  });

  test("o template avisa que é preciso remixar para cadastrar", async ({ page }) => {
    await installMocks(page, { modoTemplate: true });
    await page.goto("/");
    await page.getByRole("tab", { name: "Criar conta" }).click();

    // O aviso tem que ser explícito sobre a AÇÃO necessária, não um erro técnico.
    await expect(
      page.getByText("Você precisa fazer o remix para cadastrar sua conta nesta plataforma"),
    ).toBeVisible();
    await expect(page.getByText("Remix", { exact: false }).first()).toBeVisible();
  });

  test("clicar num registro abre o detalhe com quem lançou, quando e para onde ir", async ({ page }) => {
    await loginWithMocks(page);
    await page.goto("/receivables");

    const linha = page.getByRole("button", { name: "Abrir detalhes do registro" }).first();
    await expect(linha).toBeVisible();
    await linha.click();

    const modal = page.getByRole("dialog");
    await expect(modal).toBeVisible();
    // O que é, quanto vale e a que tipo pertence.
    await expect(modal.getByText("Fatura mensal · Horizonte")).toBeVisible();
    await expect(modal.getByText("Conta a receber").first()).toBeVisible();
    // Quem lançou e quando — o rastro que o usuário pediu.
    await expect(modal.getByText(/Lançado por|gerado pelo sistema/)).toBeVisible();
    await expect(modal.getByText("Vencimento")).toBeVisible();
    // Navegabilidade: dá para seguir para os registros ligados e para a lista.
    await expect(modal.getByText("Registros ligados")).toBeVisible();
    await expect(modal.getByRole("link", { name: /Ver todos em/ })).toBeVisible();

    // Sem bloqueio: fecha por Esc.
    await page.keyboard.press("Escape");
    await expect(modal).not.toBeVisible();
  });

  test("o detalhe encadeia registros e o voltar desfaz um passo", async ({ page }) => {
    await loginWithMocks(page);
    await page.goto("/receivables");
    await page.getByRole("button", { name: "Abrir detalhes do registro" }).first().click();

    const modal = page.getByRole("dialog");
    await modal.getByRole("button", { name: /Cliente/ }).first().click();
    await expect(modal.getByRole("button", { name: "Voltar" })).toBeVisible();

    await modal.getByRole("button", { name: "Voltar" }).click();
    await expect(modal.getByText("Fatura mensal · Horizonte")).toBeVisible();
  });

  test("a sidebar recolhe para só ícones e volta", async ({ page }) => {
    await loginWithMocks(page);
    const sidebar = page.getByRole("complementary", { name: "Navegação principal" });

    await sidebar.getByRole("button", { name: "Recolher menu" }).click();
    await expect(sidebar.getByRole("button", { name: "Expandir menu" })).toBeVisible();
    // No modo recolhido não há o título nem o seletor de perfil.
    await expect(sidebar.getByRole("heading", { name: "FinanceAI" })).toHaveCount(0);
    // O Painel continua acessível como ícone (aria-label preservado).
    await expect(sidebar.getByRole("link", { name: "Painel" })).toBeVisible();

    await sidebar.getByRole("button", { name: "Expandir menu" }).click();
    await expect(sidebar.getByRole("heading", { name: "FinanceAI" })).toBeVisible();
  });

  test("o dashboard prioriza quatro KPIs e gráficos comparáveis", async ({ page }) => {
    await loginWithMocks(page);

    for (const label of ["Receita", "Resultado", "Margem Bruta", "Margem Operacional"]) {
      await expect(page.locator("article").filter({ hasText: label })).toHaveCount(1);
    }
    await expect(page.getByRole("region", { name: "Estrutura de custos do mês" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Evolução da margem operacional" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Margem por CNPJ" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Participação na receita" })).toBeVisible();
    await expect(page.locator(".recharts-pie")).toHaveCount(0);
    await expect(page.getByText("Sem dados para visualizar")).toHaveCount(0);

    if (process.env.CAPTURE_DESIGN_SYSTEM === "1") {
      await page.waitForTimeout(1_600);
      await page.screenshot({
        path: "artifacts/design-system/dashboard-redesign-light.png",
        fullPage: true,
      });
    }
  });

  test("gráficos sem movimento exibem estado vazio em vez de formas enganosas", async ({ page }) => {
    await loginWithMocks(page, { marginRows: [] });

    await expect(page.getByText("Sem dados para visualizar")).toHaveCount(3);
    await expect(page.locator(".recharts-wrapper")).toHaveCount(0);
    await expect(page.getByText("Sem variação")).toHaveCount(4);
  });

  test("o cockpit mostra pulso, metas, aging e radar operacional", async ({ page }) => {
    await loginWithMocks(page);

    await expect(page.getByRole("heading", { name: "Caixa e compromissos" })).toBeVisible();
    for (const tile of ["Caixa", "Runway", "MRR", "Inadimplência"]) {
      await expect(page.getByText(tile, { exact: true })).toBeVisible();
    }
    await expect(page.getByRole("heading", { name: /Metas do (grupo|mês)/ })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Aberto por vencimento" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Radar operacional" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Onde agir agora" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Análise da IA" })).toBeVisible();

    if (process.env.CAPTURE_DESIGN_SYSTEM === "1") {
      await page.waitForTimeout(1_600);
      await page.screenshot({ path: "artifacts/design-system/cockpit-desktop-light.png", fullPage: true });
    }
  });

  test("a caixa de entrada bancária revisa e importa o extrato do banco", async ({ page }) => {
    await loginWithMocks(page, {
      bankConnections: [{
        id: "cccccccc-0000-4000-8000-000000000001",
        provider: "pluggy",
        external_id: "item-1",
        institution_name: "Banco Sandbox",
        institution_image: null,
        status: "updated",
        last_synced_at: null,
        consent_expires_at: null,
      }],
      bankRaw: [
        { id: "bbbbbbb1-0000-4000-8000-000000000001", date: "2026-07-28", description: "TED RECEBIDA CLIENTE XYZ", amount: 3500, direction: "revenue" },
        { id: "bbbbbbb2-0000-4000-8000-000000000002", date: "2026-07-29", description: "PIX ENVIADO FORNECEDOR ABC", amount: 1240, direction: "expense" },
      ],
    });
    await page.goto("/bank-inbox");

    await expect(page.getByRole("heading", { name: "Conciliação bancária" })).toBeVisible();
    await expect(page.getByText("TED RECEBIDA CLIENTE XYZ")).toBeVisible();
    await expect(page.getByText("2 de 2 selecionada(s)")).toBeVisible();

    await page.getByRole("button", { name: /Importar 2 para o resultado/ }).click();
    await expect(page.getByText("2 importado(s)")).toBeVisible();
  });

  test("o assistente de instalação percorre os 7 passos com tudo pulável", async ({ page }) => {
    await loginWithMocks(page, { onboardingIncompleto: true });

    await expect(page.getByRole("heading", { name: "Bem-vindo" })).toBeVisible();
    await expect(page.getByText("Tudo aqui é opcional")).toBeVisible();

    await page.getByRole("button", { name: "Próximo" }).click();
    await expect(page.getByRole("heading", { name: "Sua empresa" })).toBeVisible();
    await expect(page.getByPlaceholder("Ex.: preciso mesmo de CNPJ? O que é a API do Asaas?")).toBeVisible();

    await page.getByRole("button", { name: "Pular" }).click();
    await expect(page.getByRole("heading", { name: "Mais CNPJs" })).toBeVisible();

    await page.getByRole("button", { name: "Pular" }).click();
    await expect(page.getByRole("heading", { name: "Sua equipe" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Gerar e copiar convite" })).toBeVisible();

    // Passo central: TODA a configuração da plataforma num lugar só.
    await page.getByRole("button", { name: "Pular" }).click();
    await expect(page.getByRole("heading", { name: "Configuração da plataforma" })).toBeVisible();
    for (const nome of ["Open Finance (Pluggy)", "Asaas — cobrança automática", "WhatsApp (Evolution API)", "NFS-e Nacional — nota de serviço"]) {
      await expect(page.getByText(nome, { exact: true })).toBeVisible();
    }

    await page.getByRole("button", { name: "Pular" }).click();
    await expect(page.getByRole("heading", { name: "Conectar banco" })).toBeVisible();

    await page.getByRole("button", { name: "Pular" }).click();
    await expect(page.getByRole("heading", { name: "Pronto" })).toBeVisible();
  });

  test("cada integração abre com testar conexão, salvar e guia de como obter", async ({ page }) => {
    await loginWithMocks(page, { onboardingIncompleto: true });
    for (let i = 0; i < 4; i++) await page.getByRole("button", { name: "Pular" }).click();
    await expect(page.getByRole("heading", { name: "Configuração da plataforma" })).toBeVisible();

    await page.getByRole("button", { name: "Configurar" }).first().click();

    // As três ações que o admin precisa: salvar, testar e pedir ajuda.
    await expect(page.getByRole("button", { name: "Salvar configuração" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Testar conexão" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Como obter esta chave" })).toBeVisible();
    // Salvar começa desabilitado até os campos obrigatórios existirem.
    await expect(page.getByRole("button", { name: "Salvar configuração" })).toBeDisabled();

    // O guia traz passo a passo e o custo estimado do provedor.
    await page.getByRole("button", { name: "Como obter esta chave" }).click();
    await expect(page.getByText("Como obter, passo a passo")).toBeVisible();
    await expect(page.getByText("Custo estimado")).toBeVisible();

    // Nada é obrigatório: dá para sair sem configurar.
    await expect(page.getByRole("button", { name: "Pular por enquanto" })).toBeVisible();
  });

  test("o wizard oferece o Stripe com os quatro campos da conta", async ({ page }) => {
    // Regressão real: o Stripe existia no catálogo e não aparecia na tela de
    // Integrações, que tinha uma lista escrita à mão. O admin não tinha onde
    // colar a chave. Aqui o wizard tem que oferecer, e com os campos certos.
    await loginWithMocks(page, { onboardingIncompleto: true });
    for (let i = 0; i < 4; i++) await page.getByRole("button", { name: "Pular" }).click();
    await expect(page.getByRole("heading", { name: "Configuração da plataforma" })).toBeVisible();

    // O card é o menor elemento que contém ao mesmo tempo o nome e o botão.
    const cartao = page
      .locator("div")
      .filter({ has: page.getByText("Stripe — cartão e repasse conciliado") })
      .filter({ has: page.getByRole("button", { name: /Configurar|Revisar/ }) })
      .last();
    await expect(cartao).toBeVisible();
    await cartao.getByRole("button", { name: /Configurar|Revisar/ }).click();

    await expect(page.getByLabel("Chave secreta")).toBeVisible();
    await expect(page.getByLabel("Chave publicável")).toBeVisible();
    await expect(page.getByLabel("Segredo do webhook")).toBeVisible();
    await expect(page.getByLabel("Ambiente")).toBeVisible();
    // A secreta é segredo: vai para o cofre, não para a tabela.
    await expect(page.getByText("Guardado no cofre cifrado do servidor")).toBeVisible();
  });

  test("favoritos salvos aparecem no topo do sidebar", async ({ page }) => {
    await loginWithMocks(page);

    await expect(page.getByText("Favoritos", { exact: true })).toBeVisible();
    const fav = page.locator("nav").getByRole("link", { name: /Remover DRE dos favoritos|DRE/ }).first();
    await expect(fav).toBeVisible();
  });

  test("o PDV monta o carrinho e habilita a finalização", async ({ page }) => {
    await loginWithMocks(page);
    await page.goto("/pdv");

    await expect(page.getByRole("heading", { name: "PDV" })).toBeVisible();
    await expect(page.getByRole("button", { name: /Finalizar venda/ })).toBeDisabled();

    const tileCafe = page.getByRole("button", { name: "Café Especial 250g R$ 42,00", exact: false }).first();
    await tileCafe.click();
    await tileCafe.click();
    await page.getByRole("button", { name: "Caneca Logo R$ 35,00", exact: false }).first().click();

    await expect(page.getByText("R$ 119,00").first()).toBeVisible();
    await expect(page.getByRole("button", { name: /Finalizar venda/ })).toBeEnabled();

    await page.getByLabel("Buscar produto").fill("789100000002");
    await page.getByLabel("Buscar produto").press("Enter");
    await expect(page.getByText("R$ 154,00").first()).toBeVisible();
  });

  test("a DRE consolidada mostra a matriz conta × CNPJ com totais do grupo", async ({ page }) => {
    await loginWithMocks(page);
    await page.goto("/consolidado");

    await expect(page.getByRole("heading", { name: "DRE Consolidada do Grupo" })).toBeVisible();
    await expect(page.getByText("Receita de Serviços")).toBeVisible();
    await expect(page.getByRole("cell", { name: "Resultado" })).toBeVisible();
    await expect(page.getByText("lançamento(s) intercompany eliminados", { exact: false })).toBeVisible();
    await expect(page.getByRole("button", { name: "CSV" })).toBeEnabled();
  });

  test("a Central do Contador oferece os quatro artefatos por período", async ({ page }) => {
    await loginWithMocks(page);
    await page.goto("/contador");

    await expect(page.getByRole("heading", { name: "Central do Contador" })).toBeVisible();
    for (const artefato of ["Diário de lançamentos", "Razão por conta", "Partidas dobradas", "Plano de contas"]) {
      await expect(page.getByRole("heading", { name: artefato })).toBeVisible();
    }
    await expect(page.getByRole("button", { name: "Pacote do mês" })).toBeVisible();
  });

  test("o BI self-service oferece o wizard de nova visão", async ({ page }) => {
    await loginWithMocks(page);

    await expect(page.getByRole("heading", { name: "Minhas visões" })).toBeVisible();
    await expect(page.getByText("Monte o seu primeiro gráfico")).toBeVisible();

    await page.getByRole("button", { name: "Novo gráfico" }).click();
    await expect(page.getByRole("heading", { name: "Nova visão" })).toBeVisible();
    await expect(page.getByText("1 · Métrica")).toBeVisible();
    await expect(page.getByRole("button", { name: "Adicionar ao cockpit" })).toBeDisabled();
  });

  test("a página de agentes mostra a galeria de templates ativáveis", async ({ page }) => {
    await loginWithMocks(page);
    await page.goto("/agents");

    await expect(page.getByRole("heading", { name: "Galeria de agentes" })).toBeVisible();
    for (const nome of ["Vigia de Caixa", "Sentinela de Contas", "Guarda Fiscal", "Vigia de Metas", "Resumo do CFO", "Vigia de Recompra", "Analista Sob Medida"]) {
      await expect(page.getByText(nome, { exact: true })).toBeVisible();
    }
    await expect(page.getByRole("button", { name: "Ativar", exact: true })).toHaveCount(7);
    await expect(page.getByRole("heading", { name: "Fila de aprovação" })).toBeVisible();
  });

  test("o vazio da DRE convida a conectar o banco, não a colar extrato", async ({ page }) => {
    await loginWithMocks(page);
    await page.goto("/dre");

    await expect(page.getByRole("link", { name: "Conectar banco" })).toBeVisible();
    await expect(page.getByText("ou cole um extrato manualmente")).toBeVisible();
    await expect(page.getByRole("button", { name: "Colar extrato" })).toHaveCount(0);
  });

  test("a tela de login oferece a demonstração guiada", async ({ page }) => {
    await page.goto("/");

    await expect(page.getByRole("button", { name: "Ver demonstração guiada" })).toBeVisible();
    await expect(page.getByText("Conta compartilhada e somente leitura", { exact: false })).toBeVisible();
  });

  test("com a instalação fechada, criar conta avisa que a entrada é por convite", async ({ page }) => {
    // Depois do primeiro usuário a instalação só aceita convite. Dizer isso ANTES
    // do formulário evita a pessoa preencher tudo para tomar uma recusa no fim.
    await installMocks(page, { cadastroPorConvite: true });
    await page.goto("/");
    await page.getByRole("tab", { name: "Criar conta" }).click();

    await expect(page.getByText("Esta plataforma entra por convite")).toBeVisible();
    await expect(page.getByText("Peça a ele um link de convite", { exact: false })).toBeVisible();
  });

  test("com convite na mão, o cadastro segue normal", async ({ page }) => {
    await installMocks(page, { cadastroPorConvite: true });
    await page.goto("/?invite=7f3d9c10-1b2a-4c3d-8e4f-5a6b7c8d9e0f");
    await page.getByRole("tab", { name: "Criar conta" }).click();

    await expect(page.getByText("Convite reconhecido")).toBeVisible();
    await expect(page.getByText("Esta plataforma entra por convite")).toHaveCount(0);
  });

  test("no remix a demonstração some da tela de login", async ({ page }) => {
    // O remix clona o banco, então a vitrine viaja junto — mas não é dali. O
    // botão não pode ser oferecido: aquela conta está prestes a deixar de
    // existir, e oferecer um login que vai falhar é pior que não oferecer.
    await installMocks(page, { semDemonstracao: true });
    await page.goto("/");

    await expect(page.getByRole("heading", { name: "Bem-vindo de volta." })).toBeVisible();
    await expect(page.getByRole("button", { name: "Ver demonstração guiada" })).toHaveCount(0);
    await expect(page.getByText("Conta compartilhada e somente leitura", { exact: false })).toHaveCount(0);
  });

  test("o botão de demonstração entra na conta demo e conduz o tour", async ({ page }) => {
    await installMocks(page, { demoUser: true });
    await page.goto("/");
    await page.getByRole("button", { name: "Ver demonstração guiada" }).click();

    // Passo 1: cockpit, com o badge de somente leitura no topo.
    await expect(page.getByRole("heading", { name: "Painel Consolidado" })).toBeVisible();
    await expect(page.getByText("Modo demonstração · somente leitura")).toBeVisible();
    const tour = page.getByRole("complementary", { name: "Tour da demonstração" });
    await expect(tour.getByText("Passo 1 de 5")).toBeVisible();
    await expect(tour.getByText("O cockpit do seu dinheiro")).toBeVisible();
    // Na demo o widget flutuante do CFO some (colidia com os botões do tour).
    await expect(page.getByRole("button", { name: "Abrir CFO Digital" })).toHaveCount(0);

    // Continuar navega para o passo 2 (caixa de entrada bancária).
    await tour.getByRole("button", { name: "Continuar" }).click();
    await expect(page).toHaveURL(/\/bank-inbox$/);
    await expect(tour.getByText("Passo 2 de 5")).toBeVisible();
    await expect(tour.getByRole("button", { name: "Passo anterior" })).toBeVisible();

    // Fechar vira o atalho "Retomar tour"; retomar volta ao mesmo passo.
    await tour.getByRole("button", { name: "Fechar tour" }).click();
    const retomar = page.getByRole("button", { name: "Retomar tour" });
    await expect(retomar).toBeVisible();
    await retomar.click();
    await expect(tour.getByText("Passo 2 de 5")).toBeVisible();
  });

  test("o dashboard redesenhado preserva o viewport @mobile", async ({ page }) => {
    await loginWithMocks(page);

    await expect(page.getByRole("button", { name: "Abrir menu" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Indicadores essenciais" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Evolução da margem operacional" })).toBeVisible();

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(1);

    if (process.env.CAPTURE_DESIGN_SYSTEM === "1") {
      await page.waitForTimeout(1_600);
      await page.screenshot({
        path: "artifacts/design-system/dashboard-redesign-mobile-light.png",
        fullPage: true,
      });
    }
  });

  test("as 57 rotas protegidas preservam o viewport @mobile", async ({ page }) => {
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

    // page.goto derruba requests em voo (sino/prefs consultam em toda rota) e
    // o WebKit/Chromium reporta o abort como pageerror. Navegação real é
    // client-side e não aborta nada; filtramos só esse ruído.
    const ruidoDeNavegacao = /due to access control checks|Load failed|cancelled|aborted|NetworkError/i;
    expect(pageErrors.filter((e) => !ruidoDeNavegacao.test(e))).toEqual([]);
  });
});

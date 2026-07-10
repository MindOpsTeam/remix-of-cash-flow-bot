import { test, expect, type Page } from "@playwright/test";

const EMAIL = process.env.E2E_EMAIL ?? "e2e.financeai@example.com";
const PASSWORD = process.env.E2E_PASSWORD ?? "";

async function login(page: Page) {
  await page.goto("/");
  // Dois painéis (login/cadastro) coexistem no DOM — escopar ao form de login
  const loginForm = page.locator(".lsf-form-box.login form");
  await loginForm.getByPlaceholder("Email").fill(EMAIL);
  await loginForm.getByPlaceholder("Senha").fill(PASSWORD);
  await loginForm.getByRole("button", { name: "Entrar" }).click();
  // Painel do tenant de teste (empresa única → título = nome da empresa)
  await expect(
    page.getByRole("heading", { name: /Painel|E2E Test Corp/ }),
  ).toBeVisible({ timeout: 20_000 });
}

test.describe("fluxo autenticado", () => {
  test.skip(!PASSWORD, "E2E_PASSWORD não definido");

  test("login real → dashboard renderiza", async ({ page }) => {
    await login(page);
    await expect(page.getByText(/Margem|Receita|CNPJ/i).first()).toBeVisible();
  });

  test("páginas novas do pivô renderizam com empty states", async ({ page }) => {
    await login(page);

    await page.goto("/agents");
    await expect(page.getByRole("heading", { name: "Agentes" })).toBeVisible();
    await expect(page.getByText(/Nenhuma ação aguardando|aguardando aprovação/i).first()).toBeVisible();

    await page.goto("/close");
    await expect(page.getByRole("heading", { name: "Fechamento mensal" })).toBeVisible();
    await expect(page.getByText("Lançamentos pendentes de confirmação")).toBeVisible();

    await page.goto("/budget");
    await expect(page.getByRole("heading", { name: /Orçamento \d{4}/ })).toBeVisible();

    await page.goto("/settings/consolidation");
    await expect(page.getByRole("heading", { name: "Plano de contas do grupo" })).toBeVisible();
  });

  test("cria e revoga chave da API pública pela UI", async ({ page }) => {
    await login(page);
    await page.goto("/settings/api");
    await expect(page.getByRole("heading", { name: "API pública" })).toBeVisible();

    await page.getByLabel("Nome da chave").fill("chave-e2e");
    await page.getByRole("button", { name: "Criar chave" }).click();
    await expect(page.getByText(/copie agora/i)).toBeVisible({ timeout: 15_000 });

    // A chave aparece na lista e pode ser revogada
    await page.getByRole("button", { name: "Fechar" }).click();
    await expect(page.getByText("chave-e2e")).toBeVisible();
    await page.getByRole("button", { name: "Revogar" }).first().click();
    await expect(page.getByText("Revogada").first()).toBeVisible({ timeout: 10_000 });
  });

  test("fecha e reabre um mês no fechamento assistido", async ({ page }) => {
    await login(page);
    await page.goto("/close");
    await page.getByRole("button", { name: /^Fechar / }).click();
    await expect(page.getByText(/Mês fechado em/)).toBeVisible({ timeout: 15_000 });
    await page.getByRole("button", { name: "Reabrir" }).click();
    await expect(page.getByRole("button", { name: /^Fechar / })).toBeVisible({ timeout: 10_000 });
  });

  test("dashboard sem overflow horizontal no mobile @mobile", async ({ page }) => {
    await login(page);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(1);

    await page.goto("/agents");
    await expect(page.getByRole("heading", { name: "Agentes" })).toBeVisible();
    const overflowAgents = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflowAgents).toBeLessThanOrEqual(1);
  });
});

test.describe("público", () => {
  test("login renderiza e rota protegida redireciona", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(
      page.locator(".lsf-form-box.login").getByRole("button", { name: "Entrar" }),
    ).toBeVisible({ timeout: 15_000 });
  });

  test("PWA manifest publicado", async ({ request }) => {
    const res = await request.get("/manifest.webmanifest");
    expect(res.ok()).toBe(true);
    const manifest = await res.json();
    expect(manifest.name).toContain("FinanceAI");
  });
});

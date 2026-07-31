import { test, expect, type Page } from "@playwright/test";

/**
 * Caixa de entrada bancária contra o Supabase REAL (issue #28): roda apenas
 * com E2E_PASSWORD definido, no mesmo tenant de teste do app.spec. Sem
 * conexão Open Finance no tenant, o aceite é o convite de conexão — o que
 * importa é a página real montar sobre RLS real, não o mock.
 */

const EMAIL = process.env.E2E_EMAIL ?? "e2e.financeai@example.com";
const PASSWORD = process.env.E2E_PASSWORD ?? "";

async function login(page: Page) {
  await page.goto("/");
  const loginForm = page.getByRole("form", { name: "Entrar no FinanceAI" });
  await loginForm.getByLabel("Email").fill(EMAIL);
  await loginForm.getByLabel("Senha").fill(PASSWORD);
  await loginForm.getByRole("button", { name: "Entrar no FinanceAI" }).click();
  await expect(page.getByRole("heading", { name: /Painel|E2E Test Corp/ })).toBeVisible({ timeout: 20_000 });
}

test.describe("caixa de entrada bancária (tenant real)", () => {
  test.skip(!PASSWORD, "E2E_PASSWORD não definido");

  test("a página monta sob RLS real e oferece o caminho de conexão", async ({ page }) => {
    await login(page);
    await page.goto("/bank-inbox");

    await expect(page.getByRole("heading", { name: "Extrato bancário" })).toBeVisible();
    // Tenant limpo: sem staging pendente, o convite de conexão é o aceite.
    await expect(
      page.getByText(/Conecte o banco|Tudo revisado|selecionada\(s\)/).first(),
    ).toBeVisible({ timeout: 15_000 });
  });
});

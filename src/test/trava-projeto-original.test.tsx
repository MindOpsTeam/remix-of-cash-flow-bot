import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { readFileSync } from "node:fs";

const mockPlataformaBloqueada = vi.fn();
vi.mock("@/lib/rpc-plataforma", () => ({
  plataformaBloqueada: () => mockPlataformaBloqueada(),
}));

import { FaixaProjetoOriginal } from "@/components/plataforma/FaixaProjetoOriginal";
import { AVISO_COMPLETO, AVISO_TITULO } from "@/lib/plataforma-avisos";

/**
 * A trava do projeto original tem que sumir no remix.
 *
 * É o teste que não pode falhar: se a faixa aparecesse na instalação do
 * cliente, ele veria "não edite aqui" no produto que acabou de comprar. Tudo
 * pendura em `plataforma_bloqueada()`, que só é verdadeiro no banco de origem.
 */

function montar() {
  return render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <FaixaProjetoOriginal />
    </QueryClientProvider>,
  );
}

describe("faixa do projeto original", () => {
  const topOriginal = Object.getOwnPropertyDescriptor(window, "top");

  function fingirEditor(dentro: boolean) {
    // O editor do Lovable renderiza o preview em iframe; o site publicado é
    // janela de topo. É esse par que separa quem edita de quem compra.
    Object.defineProperty(window, "top", {
      configurable: true,
      get: () => (dentro ? ({} as Window) : window),
    });
  }

  beforeEach(() => mockPlataformaBloqueada.mockReset());
  afterEach(() => {
    if (topOriginal) Object.defineProperty(window, "top", topOriginal);
  });

  it("aparece no editor quando o banco diz que é o original", async () => {
    fingirEditor(true);
    mockPlataformaBloqueada.mockResolvedValue(true);
    montar();
    expect(await screen.findByText(AVISO_TITULO)).toBeTruthy();
  });

  it("NÃO aparece no remix — é o caso que quebraria o cliente", async () => {
    fingirEditor(true);
    mockPlataformaBloqueada.mockResolvedValue(false);
    montar();
    await waitFor(() => expect(mockPlataformaBloqueada).toHaveBeenCalled());
    expect(screen.queryByText(AVISO_TITULO)).toBeNull();
  });

  it("NÃO suja a vitrine publicada, mesmo sendo o original", async () => {
    fingirEditor(false);
    mockPlataformaBloqueada.mockResolvedValue(true);
    montar();
    await waitFor(() => expect(mockPlataformaBloqueada).toHaveBeenCalled());
    expect(screen.queryByText(AVISO_TITULO)).toBeNull();
  });
});

describe("a frase é uma só", () => {
  // Quatro cópias soltas divergem, e quem lê duas versões diferentes conclui
  // que nenhuma vale. Estes arquivos precisam repetir a MESMA frase.
  // Fragmentos que não cruzam quebra de linha: a frase é quebrada para caber em
  // 80 colunas, e casar o texto corrido tornaria o teste refém da largura.
  const trechos = [
    "PARE. ESTE É O PROJETO ORIGINAL. NÃO EDITE AQUI.",
    "FAÇA O REMIX.",
    "só gasta o seu crédito e o seu tempo.",
  ];

  it("o módulo central contém a frase inteira", () => {
    for (const t of trechos) expect(AVISO_COMPLETO).toContain(t);
  });

  it.each(["AGENTS.md", "LEIA-ANTES-DE-EDITAR.md"])("%s repete a frase", (arquivo) => {
    const texto = readFileSync(arquivo, "utf8");
    expect(texto).toContain("PARE. ESTE É O PROJETO ORIGINAL. NÃO EDITE AQUI.");
    expect(texto).toContain("FAÇA O REMIX");
  });

  // Os arquivos quentes: o que um invasor abre primeiro (marca, navegação,
  // login, tema, botão). O teste do agente de 30/08 provou que a base de
  // conhecimento e o AGENTS.md NÃO são lidos antes de editar; o conteúdo do
  // arquivo é. Se o aviso sair daqui, o portão perde o único canal que pega.
  it.each([
    "index.html",
    "src/App.tsx",
    "src/components/AppSidebar.tsx",
    "src/components/auth/LoginSignupForm.tsx",
    "src/pages/Auth.tsx",
    "src/components/ui/button.tsx",
    "src/index.css",
  ])("%s abre com o aviso, condicional e autodescartável", (arquivo) => {
    const texto = readFileSync(arquivo, "utf8");
    expect(texto).toContain("PARE. ESTE É O PROJETO ORIGINAL. NÃO EDITE AQUI.");
    expect(texto).toContain("plataforma_bloqueada()");
    expect(texto).toContain("APAGUE-O");
  });

  it.each(["AGENTS.md", "LEIA-ANTES-DE-EDITAR.md", "README.md"])(
    "%s manda a si mesmo ser apagado no remix",
    (arquivo) => {
      // Sem esta instrução o aviso viaja e vira lixo permanente na instalação
      // do cliente — o defeito que uma recusa incondicional causaria.
      const texto = readFileSync(arquivo, "utf8");
      expect(texto).toContain("plataforma_bloqueada()");
      expect(texto.toLowerCase()).toMatch(/apagu?e|apagar/);
    },
  );
});

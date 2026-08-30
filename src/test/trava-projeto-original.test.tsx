import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { readFileSync } from "node:fs";

const mockPlataformaBloqueada = vi.fn();
const mockDemonstracaoDisponivel = vi.fn();
const mockEntrar = vi.fn();
const mockUser = vi.fn();

vi.mock("@/lib/rpc-plataforma", () => ({
  plataformaBloqueada: () => mockPlataformaBloqueada(),
  demonstracaoDisponivel: () => mockDemonstracaoDisponivel(),
}));
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: mockUser() }) }));
vi.mock("@/hooks/useDemonstracao", () => ({
  useEntrarNaDemonstracao: () => ({ entrar: mockEntrar, entrando: false }),
}));

import { AvisoProjetoOriginal } from "@/components/plataforma/AvisoProjetoOriginal";
import { AVISO_COMPLETO, AVISO_TITULO, MODAL_TITULO, PASSOS_DO_REMIX } from "@/lib/plataforma-avisos";

/**
 * O aviso do projeto original tem que aparecer para quem edita e sumir no remix.
 *
 * O segundo é o teste que não pode falhar: se o popup abrisse na instalação do
 * cliente, ele levaria um "não edite aqui" na cara do produto que comprou.
 */

const TITULO_DO_POPUP = "Este projeto é somente leitura";
const TEXTO_DA_TIRA = "Projeto original · somente leitura";

function montar() {
  return render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <AvisoProjetoOriginal />
    </QueryClientProvider>,
  );
}

describe("aviso do projeto original", () => {
  const topOriginal = Object.getOwnPropertyDescriptor(window, "top");

  function fingirEditor(dentro: boolean) {
    // O editor do Lovable renderiza o preview em iframe; o site publicado é
    // janela de topo. É esse par que separa quem edita de quem compra.
    Object.defineProperty(window, "top", {
      configurable: true,
      get: () => (dentro ? ({} as Window) : window),
    });
  }

  beforeEach(() => {
    sessionStorage.clear();
    mockPlataformaBloqueada.mockReset();
    mockDemonstracaoDisponivel.mockReset().mockResolvedValue(true);
    mockEntrar.mockReset();
    mockUser.mockReset().mockReturnValue(null);
  });
  afterEach(() => {
    if (topOriginal) Object.defineProperty(window, "top", topOriginal);
  });

  it("abre sozinho no editor quando o banco diz que é o original", async () => {
    fingirEditor(true);
    mockPlataformaBloqueada.mockResolvedValue(true);
    montar();
    expect(await screen.findByText(TITULO_DO_POPUP)).toBeTruthy();
  });

  it("NÃO aparece no remix — é o caso que quebraria o cliente", async () => {
    fingirEditor(true);
    mockPlataformaBloqueada.mockResolvedValue(false);
    montar();
    await waitFor(() => expect(mockPlataformaBloqueada).toHaveBeenCalled());
    expect(screen.queryByText(TITULO_DO_POPUP)).toBeNull();
    expect(screen.queryByText(TEXTO_DA_TIRA)).toBeNull();
  });

  it("NÃO suja a vitrine publicada, mesmo sendo o original", async () => {
    fingirEditor(false);
    mockPlataformaBloqueada.mockResolvedValue(true);
    montar();
    await waitFor(() => expect(mockPlataformaBloqueada).toHaveBeenCalled());
    expect(screen.queryByText(TITULO_DO_POPUP)).toBeNull();
    expect(screen.queryByText(TEXTO_DA_TIRA)).toBeNull();
  });

  it("abre uma vez por aba: na segunda montagem só a tira fica", async () => {
    // Repetir a cada navegação transforma aviso em obstáculo, e obstáculo se
    // fecha no automático sem ler.
    fingirEditor(true);
    mockPlataformaBloqueada.mockResolvedValue(true);
    const primeira = montar();
    await screen.findByText(TITULO_DO_POPUP);
    primeira.unmount();

    montar();
    expect(await screen.findByText(TEXTO_DA_TIRA)).toBeTruthy();
    await waitFor(() => expect(screen.queryByText(TITULO_DO_POPUP)).toBeNull());
  });

  it("oferece a demonstração guiada a quem ainda não entrou", async () => {
    fingirEditor(true);
    mockPlataformaBloqueada.mockResolvedValue(true);
    montar();
    const botao = await screen.findByRole("button", { name: /ver a demonstração guiada/i });
    fireEvent.click(botao);
    expect(mockEntrar).toHaveBeenCalled();
  });

  it("não oferece a demonstração a quem já está logado", async () => {
    fingirEditor(true);
    mockPlataformaBloqueada.mockResolvedValue(true);
    mockUser.mockReturnValue({ id: "u1" });
    montar();
    await screen.findByText(TITULO_DO_POPUP);
    expect(screen.queryByRole("button", { name: /demonstração guiada/i })).toBeNull();
  });

  it("não propõe a demonstração onde ela não existe", async () => {
    // Propor um login que vai falhar é pior do que não propor nada.
    fingirEditor(true);
    mockPlataformaBloqueada.mockResolvedValue(true);
    mockDemonstracaoDisponivel.mockResolvedValue(false);
    montar();
    await screen.findByText(TITULO_DO_POPUP);
    await waitFor(() => expect(mockDemonstracaoDisponivel).toHaveBeenCalled());
    expect(screen.queryByRole("button", { name: /demonstração guiada/i })).toBeNull();
  });

  it("o caminho do remix mostra os 3 passos com print", async () => {
    fingirEditor(true);
    mockPlataformaBloqueada.mockResolvedValue(true);
    montar();
    fireEvent.click(await screen.findByRole("button", { name: /fazer o meu remix/i }));
    expect(await screen.findByText(MODAL_TITULO)).toBeTruthy();
    for (const passo of PASSOS_DO_REMIX) {
      expect(screen.getByText(passo.titulo)).toBeTruthy();
    }
  });
});

describe("a frase é uma só", () => {
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
    expect(texto).toContain(AVISO_TITULO);
    expect(texto).toContain("FAÇA O REMIX");
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

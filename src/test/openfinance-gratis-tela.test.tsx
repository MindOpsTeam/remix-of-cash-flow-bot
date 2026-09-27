import { describe, expect, it, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

/**
 * Modo grátis (MeuPluggy) do wizard de Open Finance, renderizado de verdade.
 *
 * O caminho só serve se quem recebe o remix consegue fazê-lo sozinho: o passo
 * a passo precisa aparecer na tela, a janela da Pluggy precisa abrir filtrada
 * no MeuPluggy e o Item ID colado precisa chegar ao servidor.
 */

const invoke = vi.fn();
const rpc = vi.fn();
const widgetProps: Array<Record<string, unknown>> = [];

vi.mock("@/integrations/supabase/client", () => {
  const consulta = {
    select: () => consulta,
    eq: () => consulta,
    update: () => consulta,
    maybeSingle: async () => ({ data: null }),
    then: (ok: (v: unknown) => unknown) => Promise.resolve({ error: null }).then(ok),
  };
  return {
    supabase: {
      from: () => consulta,
      rpc: (...a: unknown[]) => rpc(...a),
      functions: { invoke: (...a: unknown[]) => invoke(...a) },
    },
  };
});

// objeto estável, como o do contexto real: um novo a cada render reiniciaria o wizard
const empresa = { company: { id: "c1", name: "Empresa Teste", cnpj: "12345678000190" } };
vi.mock("@/hooks/useCompany", () => ({ useCompany: () => empresa }));

vi.mock("react-pluggy-connect", () => ({
  PluggyConnect: (props: Record<string, unknown>) => {
    widgetProps.push(props);
    return <div data-testid="janela-pluggy" />;
  },
}));

vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn(), loading: vi.fn() }),
}));

import { OpenFinanceSetupWizard } from "@/components/openfinance/OpenFinanceSetupWizard";

function abrirModoGratis() {
  render(
    <MemoryRouter>
      <OpenFinanceSetupWizard open onOpenChange={() => {}} />
    </MemoryRouter>,
  );
  fireEvent.click(screen.getByText("Conectar grátis (MeuPluggy)"));
}

async function salvarCredenciais() {
  fireEvent.change(screen.getByPlaceholderText("00000000-0000-0000-0000-000000000000"), { target: { value: "cid" } });
  fireEvent.change(screen.getByPlaceholderText("••••••••-••••-••••"), { target: { value: "segredo" } });
  fireEvent.click(screen.getByRole("button", { name: /salvar e continuar/i }));
  await screen.findByRole("button", { name: /autorizar pelo meupluggy/i });
}

beforeEach(() => {
  invoke.mockReset();
  rpc.mockReset().mockResolvedValue({ error: null });
  widgetProps.length = 0;
});

describe("wizard de Open Finance: modo grátis (MeuPluggy)", () => {
  it("a opção aparece junto de sandbox e produção, dizendo o limite", () => {
    abrirModoGratis();
    // depois do clique já está no passo das credenciais, com o passo a passo
    expect(screen.getByText(/uma vez só, uns 10 minutos, tudo grátis/i)).toBeInTheDocument();
  });

  it("explica onde nasce a credencial e que o conector MeuPluggy precisa estar ativo", () => {
    abrirModoGratis();
    expect(screen.getAllByText("dashboard.pluggy.ai").length).toBeGreaterThan(0);
    expect(screen.getByText(/sem isso a janela de autorização vem vazia/i)).toBeInTheDocument();
    expect(screen.getByText("Applications")).toBeInTheDocument();
  });

  it("salva as credenciais no cofre e leva ao passo de conectar com o roteiro do meu.pluggy.ai", async () => {
    abrirModoGratis();
    await salvarCredenciais();
    expect(rpc).toHaveBeenCalledWith("set_pluggy_credentials", {
      p_company_id: "c1", p_client_id: "cid", p_client_secret: "segredo",
    });
    expect(screen.getByText("meu.pluggy.ai")).toBeInTheDocument();
    expect(screen.getByText(/um banco por vez/i)).toBeInTheDocument();
  });

  it("abre a janela da Pluggy só com o conector MeuPluggy e sem bancos de teste", async () => {
    invoke.mockResolvedValueOnce({ data: { accessToken: "tok" }, error: null });
    abrirModoGratis();
    await salvarCredenciais();
    fireEvent.click(screen.getByRole("button", { name: /autorizar pelo meupluggy/i }));
    await screen.findByTestId("janela-pluggy");
    const props = widgetProps.at(-1)!;
    expect(props.connectorIds).toEqual([200]);
    expect(props.includeSandbox).toBe(false);
  });

  it("Item ID colado é registrado no servidor, um por um, e chega ao fim", async () => {
    invoke.mockResolvedValue({ data: { ok: true, staged: 12 }, error: null });
    abrirModoGratis();
    await salvarCredenciais();
    fireEvent.click(screen.getByText(/cole o item id/i));
    const a = "0b7a3c1e-9d2f-4a6b-8c1d-2e3f4a5b6c7d";
    const b = "11111111-2222-4333-8444-555555555555";
    fireEvent.change(screen.getByLabelText("Item IDs"), { target: { value: `${a}\n${b}` } });
    expect(screen.getByText("2 id(s) reconhecido(s)")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /conectar pelos ids/i }));
    await waitFor(() => expect(screen.getByText("Banco conectado!")).toBeInTheDocument());
    expect(invoke).toHaveBeenCalledWith("openfinance-connect", { body: { action: "register", company_id: "c1", item_id: a } });
    expect(invoke).toHaveBeenCalledWith("openfinance-connect", { body: { action: "register", company_id: "c1", item_id: b } });
    expect(screen.getByText("24 transação(ões) já vieram para revisão.")).toBeInTheDocument();
  });
});

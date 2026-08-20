import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

/**
 * A camada de previsibilidade só existe se ela CHEGA NA TELA.
 *
 * Já aconteceu neste produto de um campo ser calculado corretamente no backend
 * e nunca ser renderizado: o teste unitário ficava verde e o usuário não via
 * nada. Estes testes renderizam a tela de verdade contra uma resposta gravada e
 * conferem o que aparece.
 */

vi.mock("@/components/AppLayout", () => ({
  AppLayout: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
vi.mock("@/hooks/useCompany", () => ({
  useCompany: () => ({ company: { id: "11111111-1111-1111-1111-111111111111", name: "Empresa Teste" } }),
}));
vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ session: { access_token: "token-de-teste" } }),
}));

import CashFlowForecast from "@/pages/CashFlowForecast";

function montar() {
  return render(
    <MemoryRouter>
      <CashFlowForecast />
    </MemoryRouter>,
  );
}

const RESPOSTA = {
  forecast: [
    {
      month: "Set/26",
      projected_revenue: 500000,
      projected_expense: 90000,
      contratado_entrada: 500000,
      contratado_saida: 40000,
      confidence: "high",
      saldo_projetado: 460000,
      origem_receita: "contratado",
      faixa_receita: { p10: 420000, p90: 580000 },
    },
    {
      month: "Out/26",
      projected_revenue: 120000,
      projected_expense: 85000,
      contratado_entrada: 0,
      contratado_saida: 0,
      confidence: "medium",
      saldo_projetado: 495000,
      origem_receita: "recompra",
      esperado_recompra: 120000,
    },
  ],
  history: [{ month: "Ago/26", revenue: 110000, expense: 80000, projected: false }],
  insights: ["Setembro já está praticamente pago pelos recebíveis em carteira."],
  risk_level: "low",
  risk_explanation: "Entradas contratadas cobrem as saídas.",
  runway_meses: null,
  saldo_inicial: 50000,
  motor: "sazonal",
  precisao: {
    wape: 0.08,
    vies: 0.01,
    observacoes: 6,
    frase: "Nas últimas 6 previsões, o erro médio foi de 8%.",
  },
  recompra: { clientes_com_padrao: 4, esperado_por_mes: [0, 120000, 0] },
  saldo_conhecido: true,
};

function responderCom(corpo: unknown) {
  return vi.fn().mockResolvedValue({ ok: true, json: async () => corpo } as Response);
}

beforeEach(() => {
  vi.stubEnv("VITE_SUPABASE_URL", "https://exemplo.supabase.co");
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("tela de previsão: a camada nova aparece", () => {
  it("mostra a precisão medida em vez de prometer acerto", async () => {
    vi.stubGlobal("fetch", responderCom(RESPOSTA));
    montar();
    expect(await screen.findByText(/erro médio foi de 8%/)).toBeInTheDocument();
  });

  it("diz de onde veio o número de cada mês", async () => {
    vi.stubGlobal("fetch", responderCom(RESPOSTA));
    montar();
    expect(await screen.findByText("Já contratado")).toBeInTheDocument();
    expect(screen.getByText("Esperado por recompra")).toBeInTheDocument();
  });

  it("mostra a faixa provável, não só o número seco", async () => {
    vi.stubGlobal("fetch", responderCom(RESPOSTA));
    montar();
    expect(await screen.findByText(/Cenário provável da receita/)).toBeInTheDocument();
  });

  it("mostra quanto da receita projetada já está contratada", async () => {
    vi.stubGlobal("fetch", responderCom(RESPOSTA));
    montar();
    // 500.000 de 620.000 projetados = 81%
    expect(await screen.findByText(/81% já contratado/)).toBeInTheDocument();
  });

  it("declara o motor que calculou", async () => {
    vi.stubGlobal("fetch", responderCom(RESPOSTA));
    montar();
    expect(await screen.findByText(/Média ponderada com ajuste sazonal/)).toBeInTheDocument();
  });
});

describe("empresa nova: a tela não quebra sem as camadas novas", () => {
  const SEM_CAMADAS = {
    forecast: [
      {
        month: "Set/26",
        projected_revenue: 0,
        projected_expense: 0,
        contratado_entrada: 0,
        contratado_saida: 0,
        confidence: "low",
        saldo_projetado: 0,
      },
    ],
    history: [],
    insights: [],
    risk_level: "low",
    risk_explanation: "",
  };

  it("renderiza a projeção mesmo sem precisão, faixa nem origem", async () => {
    vi.stubGlobal("fetch", responderCom(SEM_CAMADAS));
    montar();
    await waitFor(() => expect(screen.getByText("Set/26")).toBeInTheDocument());
    // sem dados medidos, nada de número inventado na tela
    expect(screen.queryByText(/erro médio/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Cenário provável/)).not.toBeInTheDocument();
    // origem ausente cai no rótulo honesto do padrão
    expect(screen.getByText("Estimado pelo histórico")).toBeInTheDocument();
  });
});

describe("saldo desconhecido não vira saldo zero", () => {
  const SEM_SALDO = { ...RESPOSTA, saldo_conhecido: false, saldo_inicial: null, runway_meses: null };

  it("avisa que nenhuma conta tem saldo, em vez de projetar em silêncio", async () => {
    vi.stubGlobal("fetch", responderCom(SEM_SALDO));
    montar();
    expect(await screen.findByText(/Nenhuma conta bancária tem saldo informado/)).toBeInTheDocument();
    expect(screen.getByText("Informar saldo das contas")).toBeInTheDocument();
  });

  it("com saldo conhecido, não enche a tela de aviso", async () => {
    vi.stubGlobal("fetch", responderCom(RESPOSTA));
    montar();
    await screen.findByText(/erro médio foi de 8%/);
    expect(screen.queryByText(/Nenhuma conta bancária tem saldo informado/)).not.toBeInTheDocument();
  });

  it("resposta antiga, sem o campo, não inventa aviso", async () => {
    const semCampo = { ...RESPOSTA };
    delete (semCampo as Record<string, unknown>).saldo_conhecido;
    vi.stubGlobal("fetch", responderCom(semCampo));
    montar();
    await screen.findByText(/erro médio foi de 8%/);
    expect(screen.queryByText(/Nenhuma conta bancária tem saldo informado/)).not.toBeInTheDocument();
  });
});

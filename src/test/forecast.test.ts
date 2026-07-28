import { describe, it, expect } from "vitest";
// Importa o MESMO arquivo que a edge function usa. Sem cópia espelhada: régua
// duplicada é exatamente o defeito que o conselho apontou no DRE.
import { projetarCaixa, type Compromisso, type MesHistorico } from "../../supabase/functions/_shared/forecast";

const historico: MesHistorico[] = [
  { mes: "2026-02", receita: 10000, despesa: 8000 },
  { mes: "2026-03", receita: 12000, despesa: 8500 },
  { mes: "2026-04", receita: 11000, despesa: 9000 },
  { mes: "2026-05", receita: 13000, despesa: 9500 },
];

function proximoMes(offset: number): string {
  const d = new Date();
  const alvo = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + offset, 15));
  return alvo.toISOString().slice(0, 10);
}

describe("projeção de caixa determinística", () => {
  it("dá o mesmo resultado toda vez que roda", () => {
    const a = projetarCaixa(historico, [], 5000);
    const b = projetarCaixa(historico, [], 5000);
    expect(a.forecast).toEqual(b.forecast);
  });

  it("projeta o número de meses pedido e acumula saldo a partir do saldo real", () => {
    const { forecast } = projetarCaixa(historico, [], 5000, 3);
    expect(forecast).toHaveLength(3);
    // O saldo do 2º mês parte do 1º: é saldo, não delta solto.
    const delta1 = forecast[0].projected_revenue - forecast[0].projected_expense;
    expect(forecast[0].saldo_projetado).toBeCloseTo(5000 + delta1, 2);
    expect(forecast[1].saldo_projetado).toBeCloseTo(
      forecast[0].saldo_projetado + forecast[1].projected_revenue - forecast[1].projected_expense, 2);
  });

  it("pesa mais o mês recente do que o antigo", () => {
    const crescendo = projetarCaixa(
      [
        { mes: "1", receita: 1000, despesa: 0 },
        { mes: "2", receita: 2000, despesa: 0 },
        { mes: "3", receita: 3000, despesa: 0 },
      ], [], 0, 1);
    // Média simples daria 2000. Ponderada tem que ficar acima disso.
    expect(crescendo.forecast[0].projected_revenue).toBeGreaterThan(2000);
  });

  it("usa o compromisso contratado quando ele supera a média histórica", () => {
    const compromissos: Compromisso[] = [
      { data: proximoMes(1), valor: 50000, tipo: "entrada", origem: "contrato" },
    ];
    const { forecast } = projetarCaixa(historico, compromissos, 0, 1);
    expect(forecast[0].contratado_entrada).toBe(50000);
    expect(forecast[0].projected_revenue).toBe(50000);
  });

  it("separa o que está contratado do que é estimativa", () => {
    const compromissos: Compromisso[] = [
      { data: proximoMes(1), valor: 3000, tipo: "entrada", origem: "recebivel" },
      { data: proximoMes(1), valor: 2000, tipo: "saida", origem: "conta_a_pagar" },
    ];
    const { forecast } = projetarCaixa(historico, compromissos, 0, 1);
    expect(forecast[0].contratado_entrada).toBe(3000);
    expect(forecast[0].contratado_saida).toBe(2000);
    // A média histórica é maior, então ela prevalece, mas o contratado continua visível.
    expect(forecast[0].projected_revenue).toBeGreaterThan(3000);
  });

  it("calcula runway só quando a empresa queima caixa", () => {
    const queimando = projetarCaixa(
      [{ mes: "1", receita: 1000, despesa: 3000 }, { mes: "2", receita: 1000, despesa: 3000 }],
      [], 10000);
    expect(queimando.runwayMeses).toBeGreaterThan(0);

    const saudavel = projetarCaixa(
      [{ mes: "1", receita: 5000, despesa: 1000 }, { mes: "2", receita: 5000, despesa: 1000 }],
      [], 10000);
    expect(saudavel.runwayMeses).toBeNull();
  });

  it("baixa a confiança no horizonte longo e sobe quando o mês está contratado", () => {
    const { forecast } = projetarCaixa(historico, [], 0, 3);
    const ordem = { high: 3, medium: 2, low: 1 };
    expect(ordem[forecast[0].confidence]).toBeGreaterThanOrEqual(ordem[forecast[2].confidence]);
  });

  it("não quebra sem histórico nenhum", () => {
    const { forecast, runwayMeses } = projetarCaixa([], [], 0, 3);
    expect(forecast).toHaveLength(3);
    expect(forecast[0].projected_revenue).toBe(0);
    expect(runwayMeses).toBeNull();
  });
});

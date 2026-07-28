import { describe, it, expect } from "vitest";
import { montarDRE, montarSerieMensal, type LinhaView } from "@/lib/dre";

const conta = (
  grupo: LinhaView["grupo"],
  type: string,
  code: string | null,
  name: string | null,
  total: number,
): LinhaView => ({
  account_id: code ? `id-${code}` : null,
  account_code: code,
  account_name: name,
  type,
  grupo,
  total,
});

describe("montagem do DRE", () => {
  it("apura lucro bruto e líquido separando custo de despesa", () => {
    const r = montarDRE([
      conta("receita", "revenue", "3.1", "Vendas", 10000),
      conta("custo", "expense", "4.1", "Custo dos serviços", 4000),
      conta("despesa", "expense", "5.1", "Aluguel", 1000),
    ]);
    expect(r.totalReceita).toBe(10000);
    expect(r.lucroBruto).toBe(6000);
    expect(r.lucroLiquido).toBe(5000);
  });

  it("mostra o lançamento sem conta em linha própria em vez de sumir com ele", () => {
    const r = montarDRE([
      conta("receita", "revenue", "3.1", "Vendas", 10000),
      conta("a_classificar", "revenue", null, null, 7000),
      conta("a_classificar", "expense", null, null, 500),
    ]);

    // O dinheiro sem conta NÃO entra no lucro: entrar seria inventar
    // classificação que o usuário não deu.
    expect(r.totalReceita).toBe(10000);
    expect(r.lucroLiquido).toBe(10000);

    // Mas ele fica VISÍVEL, que é o ponto: 7.500 aparecem na tela.
    expect(r.naoClassificado).toBe(7500);
    const rotulos = r.linhas.map((l) => l.label);
    expect(rotulos).toContain("A classificar (entradas)");
    expect(rotulos).toContain("A classificar (saídas)");
    expect(r.linhas.filter((l) => l.alerta)).toHaveLength(2);
  });

  it("não polui o DRE com linha de alerta quando está tudo classificado", () => {
    const r = montarDRE([conta("receita", "revenue", "3.1", "Vendas", 100)]);
    expect(r.naoClassificado).toBe(0);
    expect(r.linhas.some((l) => l.alerta)).toBe(false);
  });

  it("ordena as contas pelo código, não pela ordem que o banco devolveu", () => {
    const r = montarDRE([
      conta("despesa", "expense", "5.3", "Software", 100),
      conta("despesa", "expense", "5.1", "Aluguel", 200),
      conta("despesa", "expense", "5.2", "Energia", 300),
    ]);
    const despesas = r.linhas.filter((l) => l.level === 1).map((l) => l.label);
    expect(despesas).toEqual(["5.1 – Aluguel", "5.2 – Energia", "5.3 – Software"]);
  });

  it("mostra custo e despesa como saída, com sinal negativo", () => {
    const r = montarDRE([
      conta("custo", "expense", "4.1", "Matéria-prima", 500),
      conta("despesa", "expense", "5.1", "Aluguel", 300),
    ]);
    const porRotulo = Object.fromEntries(r.linhas.map((l) => [l.label, l.value]));
    expect(porRotulo["4.1 – Matéria-prima"]).toBe(-500);
    expect(porRotulo["5.1 – Aluguel"]).toBe(-300);
    expect(porRotulo["Lucro Líquido"]).toBe(-800);
  });

  it("aguenta conta sem código e mês sem movimento nenhum", () => {
    const semCodigo = montarDRE([conta("receita", "revenue", null, "Receita avulsa", 50)]);
    expect(semCodigo.linhas.some((l) => l.label === "Receita avulsa")).toBe(true);

    const vazio = montarDRE([]);
    expect(vazio.lucroLiquido).toBe(0);
    expect(vazio.naoClassificado).toBe(0);
    expect(vazio.linhas.some((l) => l.label === "Lucro Líquido")).toBe(true);
  });

  it("aceita total vindo como string do Postgres sem virar NaN", () => {
    const r = montarDRE([
      { ...conta("receita", "revenue", "3.1", "Vendas", 0), total: "1234.56" as unknown as number },
    ]);
    expect(r.totalReceita).toBeCloseTo(1234.56, 2);
  });
});

describe("série mensal do gráfico", () => {
  const linha = (mes: string, grupo: LinhaView["grupo"], total: number) => ({ mes, grupo, total });

  it("usa a mesma régua da tabela: o não classificado fica fora do lucro", () => {
    const [ponto] = montarSerieMensal(
      [
        linha("2026-07-01", "receita", 10000),
        linha("2026-07-01", "custo", 3000),
        linha("2026-07-01", "despesa", 1000),
        linha("2026-07-01", "a_classificar", 5000),
      ],
      ["2026-07"],
    );
    expect(ponto.receitas).toBe(10000);
    expect(ponto.despesas).toBe(4000);
    expect(ponto.lucro).toBe(6000);
    expect(ponto.naoClassificado).toBe(5000);
  });

  it("mantém mês sem movimento no eixo, zerado", () => {
    const serie = montarSerieMensal([linha("2026-07-01", "receita", 100)], ["2026-05", "2026-06", "2026-07"]);
    expect(serie.map((p) => p.chave)).toEqual(["2026-05", "2026-06", "2026-07"]);
    expect(serie[0].lucro).toBe(0);
    expect(serie[2].lucro).toBe(100);
  });

  it("ignora mês fora da janela pedida em vez de somar no lugar errado", () => {
    const serie = montarSerieMensal(
      [linha("2026-01-01", "receita", 99999), linha("2026-07-01", "receita", 100)],
      ["2026-07"],
    );
    expect(serie).toHaveLength(1);
    expect(serie[0].receitas).toBe(100);
  });
});

describe("deduções de receita", () => {
  it("apura receita líquida e calcula o lucro em cima dela", () => {
    const r = montarDRE([
      conta("receita", "revenue", "3.1", "Vendas", 10000),
      conta("deducao", "expense", "3.9", "Simples Nacional", 600),
      conta("custo", "expense", "4.1", "Custo dos serviços", 3000),
      conta("despesa", "expense", "5.1", "Aluguel", 1000),
    ]);
    expect(r.totalReceita).toBe(10000);
    expect(r.totalDeducoes).toBe(600);
    expect(r.receitaLiquida).toBe(9400);
    // Lucro bruto sai da LÍQUIDA, não da bruta.
    expect(r.lucroBruto).toBe(6400);
    expect(r.lucroLiquido).toBe(5400);
  });

  it("mostra a linha de Receita Líquida entre a bruta e os custos", () => {
    const r = montarDRE([
      conta("receita", "revenue", "3.1", "Vendas", 1000),
      conta("deducao", "expense", "3.9", "ISS retido", 50),
    ]);
    const rotulos = r.linhas.map((l) => l.label);
    expect(rotulos.indexOf("Receita Bruta")).toBeLessThan(rotulos.indexOf("(-) Deduções da Receita"));
    expect(rotulos.indexOf("(-) Deduções da Receita")).toBeLessThan(rotulos.indexOf("Receita Líquida"));
    expect(rotulos.indexOf("Receita Líquida")).toBeLessThan(rotulos.indexOf("(-) Custos"));
  });

  it("não polui o DRE de quem não tem dedução nenhuma", () => {
    const r = montarDRE([conta("receita", "revenue", "3.1", "Vendas", 1000)]);
    expect(r.linhas.some((l) => l.label === "Receita Líquida")).toBe(false);
    expect(r.receitaLiquida).toBe(1000);
  });

  it("no gráfico, dedução reduz receita em vez de virar não classificado", () => {
    const [p] = montarSerieMensal(
      [
        { mes: "2026-07-01", grupo: "receita", total: 10000 },
        { mes: "2026-07-01", grupo: "deducao", total: 600 },
        { mes: "2026-07-01", grupo: "custo", total: 3000 },
      ],
      ["2026-07"],
    );
    expect(p.receitas).toBe(9400);
    expect(p.naoClassificado).toBe(0);
    expect(p.lucro).toBe(6400);
  });
});

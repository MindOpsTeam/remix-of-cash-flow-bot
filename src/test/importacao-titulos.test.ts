import { describe, expect, it } from "vitest";
import { parseValorBR, parseDataBR } from "@/components/titulos/TitulosImportDialog";

/**
 * A carga inicial é onde o cliente decide se fica ou volta pro Excel.
 *
 * Data lida errado desloca o aging inteiro e valor lido errado corrompe a
 * carteira toda. Estes dois parsers precisam ser certos ou recusar a linha:
 * nunca chutar.
 */

describe("valor: aceita o que a planilha brasileira produz", () => {
  it("lê o formato brasileiro com milhar e centavos", () => {
    expect(parseValorBR("1.234,56")).toBeCloseTo(1234.56, 2);
    expect(parseValorBR("12.345.678,90")).toBeCloseTo(12345678.9, 2);
  });

  it("lê o formato americano sem se confundir com o milhar", () => {
    expect(parseValorBR("1234.56")).toBeCloseTo(1234.56, 2);
    // sem vírgula, o ponto é decimal e não separador de milhar
    expect(parseValorBR("980.5")).toBeCloseTo(980.5, 2);
  });

  it("tolera R$ e espaço, que vêm colados do Excel", () => {
    expect(parseValorBR("R$ 4.500,00")).toBeCloseTo(4500, 2);
    expect(parseValorBR(" 300,00 ")).toBeCloseTo(300, 2);
  });

  it("devolve NaN em vez de zero quando não é número", () => {
    // zero seria gravado como título de valor zero e ninguém perceberia
    expect(Number.isNaN(parseValorBR("a combinar"))).toBe(true);
    expect(Number.isNaN(parseValorBR(""))).toBe(true);
  });
});

describe("data: certa ou recusada, nunca chutada", () => {
  it("lê dd/mm/aaaa, que é o que o brasileiro digita", () => {
    expect(parseDataBR("05/03/2026")).toBe("2026-03-05");
    expect(parseDataBR("5/3/2026")).toBe("2026-03-05");
  });

  it("lê ISO sem estragar", () => {
    expect(parseDataBR("2026-03-05")).toBe("2026-03-05");
  });

  it("aceita separador por ponto e traço", () => {
    expect(parseDataBR("05-03-2026")).toBe("2026-03-05");
    expect(parseDataBR("05.03.2026")).toBe("2026-03-05");
  });

  it("completa ano de dois dígitos no século atual", () => {
    expect(parseDataBR("05/03/26")).toBe("2026-03-05");
  });

  it("NÃO inverte dia e mês: 05/03 é 5 de março, não 3 de maio", () => {
    // o erro clássico de quem lê planilha brasileira com parser americano
    expect(parseDataBR("05/03/2026")).toBe("2026-03-05");
  });

  it("devolve null quando não dá para afirmar", () => {
    // vencimento chutado desloca o aging inteiro: recusar é melhor
    expect(parseDataBR("mês que vem")).toBeNull();
    expect(parseDataBR("")).toBeNull();
    expect(parseDataBR("32/13/2026")).toBeNull();
  });
});

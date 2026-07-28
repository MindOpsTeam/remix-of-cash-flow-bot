import { describe, it, expect } from "vitest";
import { lerLancamento } from "@/lib/lancamento-texto";

const HOJE = new Date(2026, 6, 28); // 28/07/2026

describe("lançamento em linguagem natural", () => {
  it("lê o caso que motivou a feature", () => {
    const r = lerLancamento("paguei 350 de energia ontem", HOJE);
    expect(r).toMatchObject({ valor: 350, data: "2026-07-27", tipo: "expense" });
    expect(r?.descricao.toLowerCase()).toContain("energia");
    expect(r?.incerto).toEqual([]);
  });

  it("entende entrada pelo verbo", () => {
    expect(lerLancamento("recebi 1.200,00 do cliente hoje", HOJE)).toMatchObject({
      valor: 1200, data: "2026-07-28", tipo: "revenue",
    });
    expect(lerLancamento("vendi 89,90 no balcão", HOJE)?.tipo).toBe("revenue");
  });

  it("aceita R$, milhar e centavos", () => {
    expect(lerLancamento("paguei R$ 1.240,00 de aluguel", HOJE)?.valor).toBe(1240);
    expect(lerLancamento("gastei 89,90 no mercado", HOJE)?.valor).toBe(89.9);
    expect(lerLancamento("comprei 1200 em material", HOJE)?.valor).toBe(1200);
  });

  it("lê data em vários formatos sem confundir com o valor", () => {
    expect(lerLancamento("paguei 500 de internet 05/07", HOJE)?.data).toBe("2026-07-05");
    expect(lerLancamento("paguei 500 de internet 05/07/2025", HOJE)?.data).toBe("2025-07-05");
    expect(lerLancamento("paguei 500 dia 12", HOJE)?.data).toBe("2026-07-12");
    expect(lerLancamento("paguei 500 em 3 de agosto", HOJE)?.data).toBe("2026-08-03");
    // O valor tem que continuar sendo 500 e não pedaço da data.
    expect(lerLancamento("paguei 500 de internet 05/07", HOJE)?.valor).toBe(500);
  });

  it("assume hoje e saída quando o texto não diz, mas declara a incerteza", () => {
    const r = lerLancamento("120 estacionamento", HOJE);
    expect(r).toMatchObject({ valor: 120, data: "2026-07-28", tipo: "expense" });
    expect(r?.incerto).toContain("data");
    expect(r?.incerto).toContain("tipo");
  });

  it("anteontem anda dois dias para trás", () => {
    expect(lerLancamento("paguei 40 de estacionamento anteontem", HOJE)?.data).toBe("2026-07-26");
  });

  it("não inventa lançamento sem valor", () => {
    expect(lerLancamento("paguei a conta de luz", HOJE)).toBeNull();
    expect(lerLancamento("oi", HOJE)).toBeNull();
    expect(lerLancamento("", HOJE)).toBeNull();
  });

  it("mantém o texto original quando sobra descrição vazia", () => {
    const r = lerLancamento("paguei 350 ontem", HOJE);
    expect(r?.valor).toBe(350);
    expect(r?.descricao).toBe("paguei 350 ontem");
  });

  it("limpa verbo e ruído da descrição, preservando o que importa", () => {
    const r = lerLancamento("paguei 1.500,00 de aluguel do escritório em 10/07", HOJE);
    expect(r?.descricao.toLowerCase()).toContain("aluguel");
    expect(r?.descricao.toLowerCase()).toContain("escritório");
    expect(r?.descricao.toLowerCase()).not.toContain("paguei");
  });

  it("não deixa valor zero ou negativo virar lançamento", () => {
    expect(lerLancamento("paguei 0 de nada", HOJE)).toBeNull();
  });
});

import { describe, it, expect } from "vitest";
// Importa o MESMO arquivo que as edge functions usam. Sem cópia espelhada.
import {
  lerRegras, momentoDaCobranca, PADRAO_COBRANCA, PADRAO_ANOMALIA, type LinhaRegra,
} from "../../supabase/functions/_shared/agentes";

const buscar = (linhas: LinhaRegra[]) => () => Promise.resolve({ data: linhas });

describe("régua de cobrança", () => {
  it("lembra só no dia configurado antes do vencimento, e não todo dia", () => {
    const r = { ...PADRAO_COBRANCA, dias_antes: 3 };
    expect(momentoDaCobranca(5, r)).toBeNull();
    expect(momentoDaCobranca(4, r)).toBeNull();
    expect(momentoDaCobranca(3, r)?.estagio).toBe("lembrete");
    expect(momentoDaCobranca(2, r)).toBeNull();
  });

  it("fala no dia do vencimento", () => {
    expect(momentoDaCobranca(0, PADRAO_COBRANCA)?.estagio).toBe("vencendo");
  });

  it("insiste apenas nos marcos de atraso configurados", () => {
    const r = { ...PADRAO_COBRANCA, dias_depois: [1, 7, 15] };
    expect(momentoDaCobranca(-1, r)).toMatchObject({ estagio: "atraso", diasAtraso: 1 });
    expect(momentoDaCobranca(-2, r)).toBeNull();
    expect(momentoDaCobranca(-7, r)).toMatchObject({ estagio: "atraso", diasAtraso: 7 });
    expect(momentoDaCobranca(-30, r)).toBeNull();
  });

  it("com lista de atraso vazia, cobra antes e no dia, e depois cala", () => {
    const r = { ...PADRAO_COBRANCA, dias_depois: [] };
    expect(momentoDaCobranca(3, r)?.estagio).toBe("lembrete");
    expect(momentoDaCobranca(0, r)?.estagio).toBe("vencendo");
    expect(momentoDaCobranca(-1, r)).toBeNull();
  });
});

describe("leitura das regras", () => {
  it("sem nenhuma configuração, roda no padrão e com tudo ligado", async () => {
    const r = await lerRegras(buscar([]));
    expect(r.ativo.collections).toBe(true);
    expect(r.cobranca).toEqual(PADRAO_COBRANCA);
    expect(r.anomalia).toEqual(PADRAO_ANOMALIA);
  });

  it("respeita o desligamento do agente", async () => {
    const r = await lerRegras(buscar([{ agent: "collections", ativo: false, config: {} }]));
    expect(r.ativo.collections).toBe(false);
    expect(r.ativo.anomalies).toBe(true);
  });

  it("funde o que a empresa configurou por cima do padrão", async () => {
    const r = await lerRegras(buscar([
      { agent: "collections", ativo: true, config: { dias_antes: 10, tom: "direto" } },
    ]));
    expect(r.cobranca.dias_antes).toBe(10);
    expect(r.cobranca.tom).toBe("direto");
    // O que não foi configurado continua no padrão.
    expect(r.cobranca.dias_depois).toEqual(PADRAO_COBRANCA.dias_depois);
  });

  it("prende valor absurdo na faixa em vez de aceitar", async () => {
    const r = await lerRegras(buscar([
      { agent: "anomalies", ativo: true, config: { fator: 0, janela_dias: 9999, baseline_dias: 1 } },
    ]));
    // fator 0 alertaria em TODO lançamento; janela e baseline fora da faixa
    // varreriam a tabela inteira a cada execução.
    expect(r.anomalia.fator).toBe(1.2);
    expect(r.anomalia.janela_dias).toBe(90);
    expect(r.anomalia.baseline_dias).toBe(30);
  });

  it("ignora lixo em vez de quebrar", async () => {
    const r = await lerRegras(buscar([
      { agent: "collections", ativo: true, config: { dias_antes: "amanhã", tom: "agressivo", dias_depois: "muitos" } },
    ]));
    expect(r.cobranca.dias_antes).toBe(PADRAO_COBRANCA.dias_antes);
    expect(r.cobranca.tom).toBe("cordial");
    expect(r.cobranca.dias_depois).toEqual(PADRAO_COBRANCA.dias_depois);
  });

  it("normaliza a lista de atraso: ordena, tira repetido e limita", async () => {
    const r = await lerRegras(buscar([
      { agent: "collections", ativo: true, config: { dias_depois: [15, 1, 7, 7, 0, -3, 2, 5, 9, 12, 20] } },
    ]));
    expect(r.cobranca.dias_depois).toEqual([1, 2, 5, 7, 9, 12]);
  });

  it("não deixa de rodar quando a leitura da própria configuração falha", async () => {
    const r = await lerRegras(() => Promise.reject(new Error("banco fora")));
    expect(r.ativo.collections).toBe(true);
    expect(r.cobranca).toEqual(PADRAO_COBRANCA);
  });
});

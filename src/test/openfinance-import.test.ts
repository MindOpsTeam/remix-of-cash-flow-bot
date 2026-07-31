import { describe, it, expect } from "vitest";
import {
  parseImportItems,
  janelaConciliacao,
  MAX_IMPORT_ITENS,
  FONTES_CONCILIAVEIS,
} from "../../supabase/functions/_shared/openfinance-import";

describe("parseImportItems", () => {
  it("aceita o formato revisado com conta e centro de custo", () => {
    const items = parseImportItems({
      items: [
        { raw_id: "r1", account_id: "a1", cost_center_id: "c1" },
        { raw_id: "r2", account_id: "", cost_center_id: null },
      ],
    });
    expect(items).toEqual([
      { raw_id: "r1", account_id: "a1", cost_center_id: "c1" },
      { raw_id: "r2", account_id: null, cost_center_id: null },
    ]);
  });

  it("aceita o formato legado raw_ids sem classificação", () => {
    expect(parseImportItems({ raw_ids: ["r1", "r2"] })).toEqual([
      { raw_id: "r1", account_id: null, cost_center_id: null },
      { raw_id: "r2", account_id: null, cost_center_id: null },
    ]);
  });

  it("deduplica por raw_id e descarta ids vazios ou não-string", () => {
    const items = parseImportItems({
      items: [
        { raw_id: "r1", account_id: "a1" },
        { raw_id: "r1", account_id: "a2" },
        { raw_id: "", account_id: "a3" },
        { raw_id: 42, account_id: "a4" },
      ],
    });
    expect(items).toHaveLength(1);
    expect(items[0]).toEqual({ raw_id: "r1", account_id: "a1", cost_center_id: null });
  });

  it("respeita o teto de itens por chamada", () => {
    const muitos = Array.from({ length: MAX_IMPORT_ITENS + 50 }, (_, i) => ({ raw_id: `r${i}` }));
    expect(parseImportItems({ items: muitos })).toHaveLength(MAX_IMPORT_ITENS);
  });

  it("retorna vazio para corpo malformado", () => {
    expect(parseImportItems(undefined)).toEqual([]);
    expect(parseImportItems({ items: "não é array" })).toEqual([]);
  });
});

describe("janelaConciliacao", () => {
  it("abre a janela padrão de 3 dias para cada lado", () => {
    expect(janelaConciliacao("2026-07-15")).toEqual({ de: "2026-07-12", ate: "2026-07-18" });
  });

  it("cruza fronteira de mês e de ano sem escorregar por fuso", () => {
    expect(janelaConciliacao("2026-01-01")).toEqual({ de: "2025-12-29", ate: "2026-01-04" });
    expect(janelaConciliacao("2026-08-01", 1)).toEqual({ de: "2026-07-31", ate: "2026-08-02" });
  });

  it("devolve a própria data quando o formato é irreconhecível", () => {
    expect(janelaConciliacao("data-invalida")).toEqual({ de: "data-invalida", ate: "data-invalida" });
  });

  it("as fontes conciliáveis espelham a régua do reconcile", () => {
    expect(FONTES_CONCILIAVEIS).toContain("manual");
    expect(FONTES_CONCILIAVEIS).toContain("receivable");
    expect(FONTES_CONCILIAVEIS).not.toContain("openfinance");
  });
});

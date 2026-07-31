/**
 * Regras puras da importação do staging bancário (bank_transactions_raw)
 * para o ledger (transactions).
 *
 * Ficam aqui, e não no handler, porque o front testa este arquivo direto
 * (padrão de _shared/agentes.ts): a régua de dedupe e a janela de conciliação
 * precisam de teste unitário, e handler Deno não roda no vitest.
 */

export interface ImportItem {
  raw_id: string;
  account_id: string | null;
  cost_center_id: string | null;
}

export const MAX_IMPORT_ITENS = 300;

/**
 * Fontes que representam lançamento digitado/prometido pelo humano e que,
 * portanto, podem ser o MESMO dinheiro que chegou agora pelo banco. A régua
 * espelha reconcile-transactions (list_pending): casar em vez de duplicar.
 */
export const FONTES_CONCILIAVEIS = ["manual", "whatsapp", "receivable", "texto", "contrato"] as const;

/** Dias de tolerância entre a data do banco e a data digitada pelo humano. */
export const JANELA_CONCILIACAO_DIAS = 3;

/**
 * Normaliza o corpo da ação import: aceita o formato revisado
 * (`items: [{raw_id, account_id, cost_center_id}]`) e o legado (`raw_ids`).
 * Dedupe por raw_id, teto de MAX_IMPORT_ITENS, ids vazios fora.
 */
export function parseImportItems(body: unknown): ImportItem[] {
  const b = (body ?? {}) as { items?: unknown; raw_ids?: unknown };
  const vistos = new Set<string>();
  const saida: ImportItem[] = [];

  const empurrar = (raw_id: unknown, account_id: unknown, cost_center_id: unknown) => {
    if (typeof raw_id !== "string" || raw_id.trim() === "") return;
    if (vistos.has(raw_id) || saida.length >= MAX_IMPORT_ITENS) return;
    vistos.add(raw_id);
    saida.push({
      raw_id,
      account_id: typeof account_id === "string" && account_id !== "" ? account_id : null,
      cost_center_id: typeof cost_center_id === "string" && cost_center_id !== "" ? cost_center_id : null,
    });
  };

  if (Array.isArray(b.items)) {
    for (const item of b.items) {
      const i = (item ?? {}) as Record<string, unknown>;
      empurrar(i.raw_id, i.account_id, i.cost_center_id);
    }
  } else if (Array.isArray(b.raw_ids)) {
    for (const id of b.raw_ids) empurrar(id, null, null);
  }

  return saida;
}

/**
 * Janela de datas (inclusive) para procurar um lançamento humano que seja o
 * mesmo dinheiro. Datas em 'YYYY-MM-DD'; aritmética em UTC para não escorregar
 * um dia por fuso.
 */
export function janelaConciliacao(dataIso: string, dias: number = JANELA_CONCILIACAO_DIAS): { de: string; ate: string } {
  const base = new Date(`${dataIso.slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(base.getTime())) return { de: dataIso, ate: dataIso };
  const desloca = (n: number) => {
    const d = new Date(base);
    d.setUTCDate(d.getUTCDate() + n);
    return d.toISOString().slice(0, 10);
  };
  return { de: desloca(-dias), ate: desloca(dias) };
}

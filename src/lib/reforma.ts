/**
 * Reforma Tributária (LC 214/2025) — domínio CBS/IBS.
 *
 * 2026 é o ano-teste: CBS 0,9% e IBS 0,1% devem ser DESTACADOS nos documentos
 * fiscais (NT 2025.002 e correlatas) sem recolhimento para quem cumpre as
 * obrigações acessórias. Rejeição de documentos sem o grupo começa ~03/08/2026
 * para o regime regular; Simples Nacional só destaca a partir de 2027.
 *
 * Cálculo puro e testável — os mappers de emissão consomem daqui.
 */

export const REFORMA_2026 = {
  /** Alíquota CBS do ano-teste (0,9% — LC 214/2025 art. 346). */
  cbsAliquota: 0.9,
  /** Alíquota IBS total do ano-teste (0,1% — art. 343, integralmente estadual). */
  ibsAliquota: 0.1,
  /** Parcela estadual do IBS em 2026 (0,1%). */
  ibsUfAliquota: 0.1,
  /** Parcela municipal do IBS em 2026 (0%). */
  ibsMunAliquota: 0,
  /** Início da obrigação de destaque. */
  vigenciaDestaque: "2026-01-01",
  /** Rejeição 1115 de DF-e sem grupo IBS/CBS em produção (NT 2025.002 v1.40, CRT 3). */
  inicioRejeicao: "2026-08-03",
} as const;

/** CST IBS/CBS padrão: 000 = tributação integral. */
export const CST_PADRAO = "000";

export type RegimeTributario = "simples" | "regular" | "mei";

/** Documentos alcançados pelo destaque CBS/IBS em 2026 (MDF-e fica fora). */
export const DOCS_COM_DESTAQUE = ["nfe", "nfce", "nfse", "cte"] as const;
export type DocComDestaque = (typeof DOCS_COM_DESTAQUE)[number];

export function docExigeDestaque(doc: string): doc is DocComDestaque {
  return (DOCS_COM_DESTAQUE as readonly string[]).includes(doc);
}

/**
 * Simples Nacional destaca CBS/IBS apenas a partir de 2027; regime regular
 * destaca desde 2026. MEI não destaca.
 */
export function regimeDestacaEm(regime: RegimeTributario, ano: number): boolean {
  if (regime === "mei") return false;
  if (regime === "simples") return ano >= 2027;
  return ano >= 2026;
}

export interface IbsCbsValores {
  baseCalculo: number;
  cbsAliquota: number;
  cbsValor: number;
  /** IBS total (uf + município). */
  ibsAliquota: number;
  ibsValor: number;
  /** Parcela estadual do IBS (gIBSUF). */
  ibsUfAliquota: number;
  ibsUfValor: number;
  /** Parcela municipal do IBS (gIBSMun) — 0% em 2026. */
  ibsMunAliquota: number;
  ibsMunValor: number;
}

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/** Calcula o destaque CBS/IBS do ano-teste sobre uma base (valor da operação). */
export function calcularIbsCbs(baseCalculo: number): IbsCbsValores {
  const base = round2(baseCalculo);
  const ibsUfValor = round2((base * REFORMA_2026.ibsUfAliquota) / 100);
  const ibsMunValor = round2((base * REFORMA_2026.ibsMunAliquota) / 100);
  return {
    baseCalculo: base,
    cbsAliquota: REFORMA_2026.cbsAliquota,
    cbsValor: round2((base * REFORMA_2026.cbsAliquota) / 100),
    ibsAliquota: REFORMA_2026.ibsAliquota,
    ibsValor: round2(ibsUfValor + ibsMunValor),
    ibsUfAliquota: REFORMA_2026.ibsUfAliquota,
    ibsUfValor,
    ibsMunAliquota: REFORMA_2026.ibsMunAliquota,
    ibsMunValor,
  };
}

/**
 * Grupo IBS/CBS anexado ao payload de emissão. `cClassTrib` é o código de
 * classificação tributária (tabela nacional em
 * dfe-portal.svrs.rs.gov.br/DFE/ClassificacaoTributaria); "000001" =
 * tributação integral, par do CST 000.
 */
export interface GrupoIbsCbs extends IbsCbsValores {
  cst: string;
  cClassTrib: string;
}

export const CCLASS_TRIB_PADRAO = "000001";

export function montarGrupoIbsCbs(
  baseCalculo: number,
  cClassTrib: string = CCLASS_TRIB_PADRAO,
  cst: string = CST_PADRAO,
): GrupoIbsCbs {
  return { ...calcularIbsCbs(baseCalculo), cClassTrib, cst };
}

/**
 * O mesmo destaque, nos nomes de campo que a API da Focus NFe espera na NFS-e
 * (campos marcados com "(RT)" na doc deles). A conta é a mesma de
 * `montarGrupoIbsCbs`: uma regra tributária só, dois mapeadores de saída, para
 * PlugNotas e Focus nunca divergirem no número.
 *
 * Prazo que torna isso obrigatório: a partir de 03/08/2026 o documento fiscal
 * do regime regular é rejeitado sem o grupo IBS/CBS. Simples Nacional entra em
 * 04/01/2027.
 */
export interface GrupoIbsCbsFocus {
  ibs_cbs_base_calculo: number;
  ibs_cbs_situacao_tributaria: string;
  ibs_cbs_classificacao_tributaria: string;
  cbs_aliquota: number;
  cbs_valor: number;
  ibs_uf_aliquota: number;
  ibs_uf_valor: number;
  ibs_mun_aliquota: number;
  ibs_mun_valor: number;
}

export function montarGrupoIbsCbsFocus(
  baseCalculo: number,
  cClassTrib: string = CCLASS_TRIB_PADRAO,
  cst: string = CST_PADRAO,
): GrupoIbsCbsFocus {
  const v = calcularIbsCbs(baseCalculo);
  return {
    ibs_cbs_base_calculo: v.baseCalculo,
    ibs_cbs_situacao_tributaria: cst,
    ibs_cbs_classificacao_tributaria: cClassTrib,
    cbs_aliquota: v.cbsAliquota,
    cbs_valor: v.cbsValor,
    ibs_uf_aliquota: v.ibsUfAliquota,
    ibs_uf_valor: v.ibsUfValor,
    ibs_mun_aliquota: v.ibsMunAliquota,
    ibs_mun_valor: v.ibsMunValor,
  };
}

/**
 * Prontidão da empresa para a Reforma — alimenta o checklist da UI.
 * Cada item pendente vira uma ação no card "Pronto para a Reforma".
 */
export interface ReformaReadinessInput {
  regime: RegimeTributario | null;
  cClassTribPadrao: string | null;
  emiteDocsComDestaque: boolean;
}

export interface ReformaReadinessItem {
  key: "regime" | "cclasstrib" | "destaque";
  ok: boolean;
  label: string;
}

export function reformaReadiness(input: ReformaReadinessInput, ano = 2026): {
  items: ReformaReadinessItem[];
  pronto: boolean;
} {
  const precisaDestacar =
    input.regime != null && regimeDestacaEm(input.regime, ano) && input.emiteDocsComDestaque;

  const items: ReformaReadinessItem[] = [
    {
      key: "regime",
      ok: input.regime != null,
      label: "Regime tributário informado",
    },
    {
      key: "cclasstrib",
      // Só bloqueia quem de fato precisa destacar
      ok: !precisaDestacar || Boolean(input.cClassTribPadrao),
      label: "Classificação tributária padrão (cClassTrib) definida",
    },
    {
      key: "destaque",
      ok: input.regime != null,
      label:
        input.regime === "simples"
          ? "Simples Nacional: destaque obrigatório a partir de 2027"
          : "Destaque CBS/IBS ativo nas emissões",
    },
  ];

  return { items, pronto: items.every((i) => i.ok) };
}

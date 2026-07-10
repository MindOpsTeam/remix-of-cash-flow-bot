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
  /** Alíquota CBS do ano-teste (0,9%). */
  cbsAliquota: 0.9,
  /** Alíquota IBS do ano-teste (0,1%). */
  ibsAliquota: 0.1,
  /** Início da obrigação de destaque. */
  vigenciaDestaque: "2026-01-01",
  /** Rejeição de DF-e sem grupo IBS/CBS (regime regular). */
  inicioRejeicao: "2026-08-03",
} as const;

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
  ibsAliquota: number;
  ibsValor: number;
}

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/** Calcula o destaque CBS/IBS do ano-teste sobre uma base (valor da operação). */
export function calcularIbsCbs(baseCalculo: number): IbsCbsValores {
  const base = round2(baseCalculo);
  return {
    baseCalculo: base,
    cbsAliquota: REFORMA_2026.cbsAliquota,
    cbsValor: round2((base * REFORMA_2026.cbsAliquota) / 100),
    ibsAliquota: REFORMA_2026.ibsAliquota,
    ibsValor: round2((base * REFORMA_2026.ibsAliquota) / 100),
  };
}

/**
 * Grupo IBS/CBS anexado ao payload de emissão. `cClassTrib` é o código de
 * classificação tributária (tabela nacional); "000001" = tributação integral.
 */
export interface GrupoIbsCbs extends IbsCbsValores {
  cClassTrib: string;
}

export const CCLASS_TRIB_PADRAO = "000001";

export function montarGrupoIbsCbs(
  baseCalculo: number,
  cClassTrib: string = CCLASS_TRIB_PADRAO,
): GrupoIbsCbs {
  return { ...calcularIbsCbs(baseCalculo), cClassTrib };
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

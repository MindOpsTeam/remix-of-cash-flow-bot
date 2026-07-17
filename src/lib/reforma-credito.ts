/**
 * Cadeia de crédito B2B na Reforma (LC 214/2025) — o vetor mais citado e menos
 * quantificado do mercado. Na não-cumulatividade plena, o cliente PJ credita o
 * CBS/IBS destacado na compra. Um fornecedor no **Simples padrão** (imposto "por
 * dentro" do DAS) transfere um crédito MÍNIMO; se recolher **por fora**
 * (Híbrido/Normal) transfere o crédito CHEIO. A diferença é o "crédito em risco":
 * quanto o cliente B2B perde comprando de você — e o motivo de churn/desconto.
 *
 * Puro e testável. Estimativa gerencial (alíquotas de referência configuráveis).
 */

import { IVA_REF, cbsFracao, ibsFracao } from "@/lib/reforma-simulator";
import type { ClienteCarteira } from "@/hooks/useReformaCarteira";

/** Ano de referência do regime pleno (IBS integral). */
export const ANO_PLENO = 2033;

/** Crédito transferível embutido no DAS do Simples padrão (estimativa serviços). */
export const TAXA_CREDITO_SIMPLES = 0.025;

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/** Alíquota efetiva do IVA (CBS+IBS) no ano, como fração (0..1), com redução setorial. */
export function ivaAliquotaAno(ano: number, reducao = 0): number {
  const cbs = (IVA_REF.cbs / 100) * cbsFracao(ano);
  const ibs = (IVA_REF.ibs / 100) * ibsFracao(ano);
  const fator = 1 - Math.min(Math.max(reducao, 0), 1);
  return (cbs + ibs) * fator;
}

export interface CreditoCliente {
  contactId: string;
  nome: string;
  receitaAno: number;
  /** Crédito que o cliente recebe se você recolher por fora (Híbrido/Normal). */
  creditoCheio: number;
  /** Crédito que o cliente recebe se você ficar no Simples padrão (por dentro). */
  creditoSimples: number;
  /** Diferença — o crédito que o cliente PERDE comprando de você no Simples. */
  creditoEmRisco: number;
}

export interface CreditoResultado {
  /** Só clientes B2B (B2C não usa crédito), ordenados por crédito em risco desc. */
  porCliente: CreditoCliente[];
  creditoCheioTotal: number;
  creditoSimplesTotal: number;
  creditoEmRiscoTotal: number;
  clientesB2B: number;
  receitaB2B: number;
  ano: number;
}

/**
 * Quantifica a cadeia de crédito para os clientes B2B da carteira.
 * @param clientes carteira agregada (useReformaCarteira)
 * @param ano ano de referência (default = regime pleno 2033)
 * @param reducao redução setorial do IVA (0..1)
 */
export function analisarCreditoB2B(
  clientes: ClienteCarteira[],
  ano: number = ANO_PLENO,
  reducao = 0,
): CreditoResultado {
  const rate = ivaAliquotaAno(ano, reducao);
  const taxaSimples = TAXA_CREDITO_SIMPLES * (1 - Math.min(Math.max(reducao, 0), 1));

  const porCliente: CreditoCliente[] = clientes
    .filter((c) => c.tipo === "B2B")
    .map((c) => {
      const creditoCheio = round2(c.receitaAno * rate);
      const creditoSimples = round2(c.receitaAno * taxaSimples);
      return {
        contactId: c.contactId,
        nome: c.nome,
        receitaAno: c.receitaAno,
        creditoCheio,
        creditoSimples,
        creditoEmRisco: round2(creditoCheio - creditoSimples),
      };
    })
    .sort((a, b) => b.creditoEmRisco - a.creditoEmRisco);

  return {
    porCliente,
    creditoCheioTotal: round2(porCliente.reduce((s, c) => s + c.creditoCheio, 0)),
    creditoSimplesTotal: round2(porCliente.reduce((s, c) => s + c.creditoSimples, 0)),
    creditoEmRiscoTotal: round2(porCliente.reduce((s, c) => s + c.creditoEmRisco, 0)),
    clientesB2B: porCliente.length,
    receitaB2B: round2(porCliente.reduce((s, c) => s + c.receitaAno, 0)),
    ano,
  };
}

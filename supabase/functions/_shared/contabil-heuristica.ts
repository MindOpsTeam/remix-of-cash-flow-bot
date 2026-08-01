/**
 * Classificação determinística e validação contábil.
 *
 * ⚠️ PURO E BROWSER-SAFE (igual contabil-br.ts): nada de Deno/esm.sh aqui.
 *
 * Duas responsabilidades:
 *   1) resolver ANTES da IA o que o extrato brasileiro já entrega mastigado
 *      (DAS, FGTS, tarifa, maquininha, energia, aluguel…). É mais barato, é
 *      determinístico e é auditável — três coisas que a IA não dá.
 *   2) validar o que a IA devolveu contra a doutrina, antes de virar lançamento.
 *      A IA erra silenciosamente; o DRE errado só aparece no fechamento.
 */

export type TipoLancamento = "revenue" | "expense";

export interface SugestaoContabil {
  /** Código da conta no plano padrão (3.1, 4.3, 5.7…). */
  codigo: string;
  /** Nome do centro de custo sugerido, quando o padrão é inequívoco. */
  centro?: string;
  /** Por que essa classificação — vira rastro de auditoria, não enfeite. */
  justificativa: string;
  confianca: "alta" | "media";
}

interface PadraoExtrato {
  /** Testado contra a descrição normalizada (maiúsculas, sem acento). */
  termos: string[];
  tipo: TipoLancamento | "ambos";
  sugestao: SugestaoContabil;
}

/** Normaliza como o banco escreve: caixa alta, sem acento, sem ruído. */
export function normalizarDescricao(texto: string): string {
  return (texto ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Padrões que o extrato brasileiro repete todo mês. Ordem importa: o primeiro
 * que casar vence, então o mais específico vem antes do mais genérico.
 */
const PADROES: PadraoExtrato[] = [
  // ── Tributos ────────────────────────────────────────────────────────────
  {
    termos: ["DAS SIMPLES", "DAS-SIMPLES", "SIMPLES NACIONAL", "DARF DAS"],
    tipo: "expense",
    sugestao: { codigo: "5.7", centro: "Administrativo", confianca: "alta", justificativa: "DAS é tributo sobre faturamento (conta de impostos)." },
  },
  {
    termos: ["DARF", "IRPJ", "CSLL", "PIS ", "COFINS", "ISS ", "ICMS"],
    tipo: "expense",
    sugestao: { codigo: "5.7", centro: "Administrativo", confianca: "alta", justificativa: "Tributo sobre faturamento ou lucro." },
  },
  {
    termos: ["FGTS", "GRF ", "INSS", "GPS ", "GUIA PREVIDENCIA"],
    tipo: "expense",
    sugestao: { codigo: "5.2", centro: "Administrativo", confianca: "alta", justificativa: "Encargo de pessoal acompanha o salário, não é imposto sobre faturamento." },
  },

  // ── Financeiro ──────────────────────────────────────────────────────────
  {
    termos: ["TARIFA", "CESTA DE SERVICO", "MANUTENCAO DE CONTA", "ANUIDADE"],
    tipo: "expense",
    sugestao: { codigo: "5.8", centro: "Financeiro", confianca: "alta", justificativa: "Tarifa bancária é despesa financeira." },
  },
  {
    termos: ["IOF", "JUROS", "MULTA POR ATRASO", "ENCARGOS", "MORA"],
    tipo: "expense",
    sugestao: { codigo: "5.8", centro: "Financeiro", confianca: "alta", justificativa: "Juros, multa e IOF são despesa financeira, nunca custo do produto." },
  },
  {
    termos: ["TAXA ANTECIPACAO", "ANTECIPACAO DE RECEBIVEL", "DESCONTO DE TITULO"],
    tipo: "expense",
    sugestao: { codigo: "4.3", centro: "Financeiro", confianca: "alta", justificativa: "Custo financeiro sobre a venda; a receita já foi reconhecida na venda original." },
  },
  {
    termos: ["TAXA CARTAO", "TX CARTAO", "STONE", "CIELO", "REDE ", "GETNET", "PAGSEGURO", "PAGBANK", "MERCADO PAGO", "SUMUP", "MAQUININHA"],
    tipo: "expense",
    sugestao: { codigo: "4.3", centro: "Financeiro", confianca: "alta", justificativa: "Taxa de meio de pagamento incide sobre a venda: é custo, não despesa administrativa." },
  },

  // ── Estrutura ───────────────────────────────────────────────────────────
  {
    termos: ["ALUGUEL", "LOCACAO IMOVEL", "CONDOMINIO", "IPTU"],
    tipo: "expense",
    sugestao: { codigo: "5.4", centro: "Administrativo", confianca: "alta", justificativa: "Ocupação do imóvel é despesa de estrutura." },
  },
  {
    termos: ["ENERGIA", "ELETRICA", "ENEL", "CEMIG", "COPEL", "LIGHT ", "CPFL", "EQUATORIAL", "SANEAMENTO", "SABESP", "COPASA", "AGUA "],
    tipo: "expense",
    sugestao: { codigo: "5.4", centro: "Administrativo", confianca: "media", justificativa: "Utilidade do imóvel; se houver consumo industrial relevante, reavaliar como custo." },
  },
  {
    termos: ["VIVO", "CLARO", "TIM ", "OI ", "ALGAR", "INTERNET", "TELEFON"],
    tipo: "expense",
    sugestao: { codigo: "5.5", centro: "Administrativo", confianca: "media", justificativa: "Telecom e internet como serviço de estrutura." },
  },
  {
    termos: ["GOOGLE", "AWS", "AMAZON WEB", "MICROSOFT", "AZURE", "META PLATFORMS", "OPENAI", "ANTHROPIC", "FIGMA", "SLACK", "NOTION", "ADOBE"],
    tipo: "expense",
    sugestao: { codigo: "5.5", centro: "Administrativo", confianca: "media", justificativa: "Assinatura de software; se for insumo revendido ao cliente, é custo." },
  },
  {
    termos: ["CONTABIL", "CONTADOR", "ESCRITORIO CONTAB", "ADVOCACIA", "ADVOGAD", "AUDITORIA"],
    tipo: "expense",
    sugestao: { codigo: "5.6", centro: "Administrativo", confianca: "alta", justificativa: "Honorário profissional de estrutura." },
  },
  {
    termos: ["PRO-LABORE", "PRO LABORE", "PROLABORE"],
    tipo: "expense",
    sugestao: { codigo: "5.3", centro: "Administrativo", confianca: "alta", justificativa: "Pró-labore é despesa própria, separada de salário e de distribuição de lucro." },
  },
  {
    termos: ["FOLHA", "SALARIO", "ADIANTAMENTO SALARIAL", "13 SALARIO", "FERIAS", "RESCISAO", "VALE TRANSPORTE", "VALE REFEICAO", "VR ", "VA "],
    tipo: "expense",
    sugestao: { codigo: "5.2", centro: "Administrativo", confianca: "media", justificativa: "Pessoal de estrutura; se for mão de obra direta da entrega, mover para 4.2." },
  },
  {
    termos: ["ADS", "ANUNCIO", "PATROCINIO", "MARKETING", "TRAFEGO PAGO", "IMPULSIONAMENTO"],
    tipo: "expense",
    sugestao: { codigo: "5.1", centro: "Marketing", confianca: "alta", justificativa: "Divulgação é despesa comercial." },
  },
  {
    termos: ["FRETE", "TRANSPORTADORA", "CORREIOS", "SEDEX", "LOGGI", "JADLOG"],
    tipo: "expense",
    sugestao: { codigo: "4.4", centro: "Operacional", confianca: "media", justificativa: "Frete sobre venda é custo; se for frete sobre compra, integra o custo da mercadoria (4.1)." },
  },

  // ── Receita ─────────────────────────────────────────────────────────────
  {
    termos: ["RENDIMENTO", "APLICACAO RESGATE", "CDB", "TESOURO", "POUPANCA RENDIMENTO"],
    tipo: "revenue",
    sugestao: { codigo: "3.4", centro: "Financeiro", confianca: "alta", justificativa: "Rendimento de aplicação é receita financeira, fora da operação." },
  },
  {
    termos: ["MENSALIDADE", "ASSINATURA", "RECORRENTE", "PLANO MENSAL"],
    tipo: "revenue",
    sugestao: { codigo: "3.3", centro: "Comercial", confianca: "alta", justificativa: "Cobrança recorrente de contrato." },
  },
];

/** Padrões que NUNCA são resultado: movimentação patrimonial disfarçada. */
const NAO_E_RESULTADO = [
  { termos: ["TRANSFERENCIA ENTRE CONTAS", "TRANSF ENTRE CONTAS", "APLICACAO AUTOMATICA", "RESGATE AUTOMATICO", "TED MESMA TITULARIDADE", "PIX MESMA TITULARIDADE"], motivo: "Transferência entre contas da própria empresa não é receita nem despesa: é movimentação patrimonial." },
  { termos: ["APORTE DE SOCIO", "APORTE SOCIO", "INTEGRALIZACAO"], motivo: "Aporte de sócio entra no patrimônio líquido (princípio da Entidade), não no resultado." },
  { termos: ["DISTRIBUICAO DE LUCRO", "DIVIDENDO", "RETIRADA DE LUCRO"], motivo: "Distribuição de lucro reduz o patrimônio líquido; não é despesa." },
  { termos: ["EMPRESTIMO RECEBIDO", "LIBERACAO EMPRESTIMO", "CREDITO EMPRESTIMO"], motivo: "Empréstimo recebido é passivo, não receita. Só os juros vão ao resultado." },
];

export interface ResultadoHeuristica {
  sugestao: SugestaoContabil | null;
  /** Preenchido quando o lançamento não deve virar resultado. */
  bloqueio: { motivo: string } | null;
}

/**
 * Tenta classificar sem IA. Devolve `bloqueio` quando o lançamento não pertence
 * ao DRE — esse caso é mais importante que acertar a conta, porque manda o
 * número para fora do resultado em vez de inflá-lo.
 */
export function classificarPorPadrao(descricao: string, tipo: TipoLancamento): ResultadoHeuristica {
  const texto = normalizarDescricao(descricao);
  if (!texto) return { sugestao: null, bloqueio: null };

  for (const p of NAO_E_RESULTADO) {
    if (p.termos.some((t) => texto.includes(t))) {
      return { sugestao: null, bloqueio: { motivo: p.motivo } };
    }
  }

  for (const p of PADROES) {
    if (p.tipo !== "ambos" && p.tipo !== tipo) continue;
    if (p.termos.some((t) => texto.includes(t))) return { sugestao: p.sugestao, bloqueio: null };
  }

  return { sugestao: null, bloqueio: null };
}

/* ------------------------------------------------------------------ */
/* Validação da saída (da IA ou do humano)                             */
/* ------------------------------------------------------------------ */

export interface ContaRef {
  id: string;
  code: string | null;
  type: string; // 'revenue' | 'expense'
}

export interface ProblemaContabil {
  gravidade: "erro" | "alerta";
  mensagem: string;
}

/**
 * Confere uma classificação contra a doutrina. `erro` deve bloquear o
 * lançamento; `alerta` só sinaliza para revisão humana.
 */
export function validarClassificacao(params: {
  tipo: TipoLancamento;
  descricao: string;
  conta: ContaRef | null;
}): ProblemaContabil[] {
  const problemas: ProblemaContabil[] = [];
  const { tipo, descricao, conta } = params;

  const { bloqueio } = classificarPorPadrao(descricao, tipo);
  if (bloqueio && conta) {
    problemas.push({ gravidade: "erro", mensagem: bloqueio.motivo });
  }

  if (!conta) return problemas;

  // Natureza: entrada só em receita, saída só em custo/despesa.
  if (tipo === "revenue" && conta.type !== "revenue") {
    problemas.push({ gravidade: "erro", mensagem: "Entrada classificada em conta que não é de receita." });
  }
  if (tipo === "expense" && conta.type !== "expense") {
    problemas.push({ gravidade: "erro", mensagem: "Saída classificada em conta que não é de custo/despesa." });
  }

  // Coerência com a régua 3/4/5 do plano de contas.
  const grupo = (conta.code ?? "").charAt(0);
  if (tipo === "revenue" && grupo && grupo !== "3") {
    problemas.push({ gravidade: "erro", mensagem: `Receita deve usar conta do grupo 3; veio ${conta.code}.` });
  }
  if (tipo === "expense" && grupo && !["4", "5"].includes(grupo)) {
    problemas.push({ gravidade: "erro", mensagem: `Custo/despesa deve usar grupo 4 ou 5; veio ${conta.code}.` });
  }

  // Divergência com a heurística: não bloqueia, mas pede olho humano.
  const { sugestao } = classificarPorPadrao(descricao, tipo);
  if (sugestao && conta.code && sugestao.confianca === "alta" && sugestao.codigo !== conta.code) {
    problemas.push({
      gravidade: "alerta",
      mensagem: `A descrição sugere ${sugestao.codigo} (${sugestao.justificativa}), mas foi classificado em ${conta.code}.`,
    });
  }

  return problemas;
}

/**
 * Base de conhecimento contábil brasileira — a doutrina que a IA precisa ter
 * antes de encostar num lançamento.
 *
 * ⚠️ ARQUIVO PURO E BROWSER-SAFE (mesma restrição de templates-agentes.ts):
 * é importado pelo bundle do cliente e pelo vitest. NUNCA adicione import por
 * URL, Deno.env ou API de Deno aqui.
 *
 * Divisão de trabalho:
 *   - o que é NORMA (CFC/NBC) e o que é convenção do plano de contas → aqui,
 *     escrito uma vez e injetado em todo prompt de classificação;
 *   - o que é DETERMINÍSTICO (padrão de extrato brasileiro que não admite
 *     dúvida) → heurística aqui, resolvida ANTES de gastar token com IA;
 *   - o que é JULGAMENTO → vai para a IA, mas com a doutrina no contexto e
 *     validação na volta.
 *
 * Referências: ITG 1000 (Modelo Contábil para ME e EPP), NBC TG 1000 (PME),
 * NBC TG Estrutura Conceitual, Lei 6.404/76 art. 187 (estrutura da DRE),
 * Resolução CFC 1.330/11 (ITG 2000 — escrituração contábil).
 */

/* ------------------------------------------------------------------ */
/* 1. Princípios que regem qualquer lançamento                         */
/* ------------------------------------------------------------------ */

export const PRINCIPIOS_CFC = [
  {
    nome: "Competência",
    norma: "NBC TG Estrutura Conceitual; ITG 1000 item 4",
    regra:
      "A receita e a despesa pertencem ao mês do FATO GERADOR, não ao mês do pagamento. Venda entregue em março paga em abril é receita de março.",
    impacto: "Quando houver data de competência diferente da data de caixa, a competência manda no resultado.",
  },
  {
    nome: "Entidade",
    norma: "NBC TG Estrutura Conceitual",
    regra:
      "O patrimônio da empresa não se confunde com o do sócio. Retirada, aporte, pró-labore e distribuição de lucro NÃO são receita nem despesa operacional da empresa.",
    impacto: "Movimento com o sócio nunca entra como receita; pró-labore é despesa de pessoal, distribuição de lucro reduz o patrimônio líquido.",
  },
  {
    nome: "Oportunidade",
    norma: "NBC TG Estrutura Conceitual; ITG 2000",
    regra: "O registro é feito quando o fato ocorre, com o documento que o suporta (nota, recibo, contrato, comprovante).",
    impacto: "Lançamento sem documento de suporte é risco de glosa fiscal e de rejeição pelo contador.",
  },
  {
    nome: "Registro pelo valor original",
    norma: "NBC TG Estrutura Conceitual",
    regra: "O valor é o da transação, na moeda do país. Descontos e juros são registrados à parte, não embutidos no principal.",
    impacto: "Juros pagos por atraso são despesa financeira, não aumento do custo do produto.",
  },
  {
    nome: "Prudência",
    norma: "NBC TG 1000 seção 2",
    regra: "Na dúvida entre duas classificações, escolha a que NÃO infla o resultado.",
    impacto: "Se não dá para afirmar que é receita, não classifique como receita: deixe a classificar.",
  },
] as const;

/* ------------------------------------------------------------------ */
/* 2. O divisor de águas: custo x despesa                              */
/* ------------------------------------------------------------------ */

export const CUSTO_VS_DESPESA = {
  regra:
    "CUSTO é o gasto ligado diretamente à entrega do que a empresa vende (some se ela parar de produzir/atender). DESPESA é o gasto de estrutura, que continua existindo mesmo sem uma única venda.",
  norma: "NBC TG 16 (Estoques) e Lei 6.404/76 art. 187, que separa CMV/CPV do resultado operacional.",
  teste_pratico:
    "Pergunte: 'se eu não vender nada este mês, esse gasto acontece?' Se SIM, é despesa. Se NÃO, é custo.",
  exemplos_custo: [
    "matéria-prima e mercadoria para revenda (CMV)",
    "mão de obra direta de quem produz ou executa o serviço vendido",
    "taxa da maquininha e do gateway sobre a venda",
    "frete de entrega ao cliente (frete sobre venda)",
    "comissão de vendedor sobre venda realizada",
  ],
  exemplos_despesa: [
    "aluguel e condomínio do escritório",
    "salário do administrativo, do financeiro e da diretoria",
    "pró-labore dos sócios",
    "software de gestão, contabilidade, marketing",
    "tarifa bancária, IOF e juros (despesa financeira)",
  ],
} as const;

/* ------------------------------------------------------------------ */
/* 3. Convenção do plano de contas da casa                             */
/* ------------------------------------------------------------------ */

export const PLANO_DE_CONTAS_REGUA = {
  "3": "RECEITA — tudo que aumenta o resultado por venda de produto/serviço.",
  "4": "CUSTO — gasto atrelado à venda/produção (entra no CMV/CPV, antes da margem bruta).",
  "5": "DESPESA — gasto de estrutura (depois da margem bruta, forma o resultado operacional).",
} as const;

/** O que cada conta padrão aceita e, principalmente, o que ela NÃO aceita. */
export const NATUREZA_DAS_CONTAS: Array<{
  codigo: string;
  aceita: string;
  naoAceita: string;
}> = [
  { codigo: "3.1", aceita: "venda de serviço prestado pela empresa", naoAceita: "aporte de sócio, empréstimo recebido, transferência entre contas próprias" },
  { codigo: "3.2", aceita: "venda de mercadoria/produto", naoAceita: "devolução de compra (isso reduz custo, não é receita)" },
  { codigo: "3.3", aceita: "mensalidade, assinatura e contrato recorrente", naoAceita: "venda avulsa" },
  { codigo: "3.4", aceita: "receita eventual: aluguel de bem próprio, venda de sucata, rendimento de aplicação", naoAceita: "estorno de despesa (retificar a despesa original)" },
  { codigo: "4.1", aceita: "mercadoria revendida, matéria-prima, insumo consumido na entrega", naoAceita: "material de escritório e limpeza (é despesa)" },
  { codigo: "4.2", aceita: "salário e encargos de quem produz/executa o serviço vendido", naoAceita: "salário do administrativo e do financeiro (é 5.2)" },
  { codigo: "4.3", aceita: "taxa de maquininha, gateway, split de pagamento, antecipação de recebível", naoAceita: "tarifa de manutenção de conta (é 5.8)" },
  { codigo: "4.4", aceita: "frete sobre a venda, entrega ao cliente", naoAceita: "frete sobre a compra (integra o custo da mercadoria, 4.1)" },
  { codigo: "5.1", aceita: "anúncio, agência, material de divulgação, patrocínio", naoAceita: "comissão de vendedor sobre venda (é custo, 4.x)" },
  { codigo: "5.2", aceita: "salário, encargo e benefício do pessoal de estrutura", naoAceita: "pró-labore de sócio (é 5.3)" },
  { codigo: "5.3", aceita: "pró-labore dos sócios e encargos sobre ele", naoAceita: "distribuição de lucro (não é despesa: reduz o PL)" },
  { codigo: "5.4", aceita: "aluguel, condomínio e IPTU do imóvel usado pela empresa", naoAceita: "aluguel de equipamento ligado à produção (avaliar como custo)" },
  { codigo: "5.5", aceita: "assinatura de software, hospedagem, licença", naoAceita: "software revendido ao cliente (é custo)" },
  { codigo: "5.6", aceita: "honorário do contador, advogado, auditoria", naoAceita: "" },
  { codigo: "5.7", aceita: "tributo sobre faturamento e sobre lucro: DAS, ISS, PIS, COFINS, IRPJ, CSLL", naoAceita: "INSS e FGTS do funcionário (é encargo de pessoal, 5.2/4.2)" },
  { codigo: "5.8", aceita: "juros, multa por atraso, IOF, tarifa bancária", naoAceita: "taxa de maquininha sobre venda (é 4.3)" },
];

/* ------------------------------------------------------------------ */
/* 4. Centro de custo: o critério                                      */
/* ------------------------------------------------------------------ */

export const CENTRO_DE_CUSTO_CRITERIO = {
  regra:
    "O centro de custo é de quem CONSOME o recurso, não de quem paga nem de quem assina. É rateio gerencial (contabilidade de custos), não exigência do CFC.",
  perguntas: [
    "Qual área ficaria sem esse recurso se ele fosse cortado?",
    "Se o gasto beneficia a empresa toda (aluguel, contador, tarifa bancária), o centro é Administrativo — não invente rateio sem critério.",
    "Se o gasto é da entrega ao cliente, o centro é Operacional.",
  ],
  mapa_tipico: [
    { centro: "Comercial", exemplos: "comissão, CRM, viagem de venda, brinde para cliente" },
    { centro: "Marketing", exemplos: "anúncio, agência, evento, material de divulgação" },
    { centro: "Operacional", exemplos: "insumo, mão de obra direta, frete de entrega, ferramenta de produção" },
    { centro: "Financeiro", exemplos: "tarifa bancária, juros, antecipação de recebível, taxa de maquininha" },
    { centro: "Administrativo", exemplos: "aluguel, contador, software de gestão, energia, limpeza, pró-labore" },
  ],
  quando_deixar_nulo:
    "Se o lançamento não tem dono claro e o rateio seria chute, deixe o centro de custo vazio. Centro errado é pior que centro vazio: ele contamina a análise gerencial e ninguém percebe.",
} as const;

/* ------------------------------------------------------------------ */
/* 5. Armadilhas do extrato brasileiro                                 */
/* ------------------------------------------------------------------ */

export const ARMADILHAS = [
  {
    caso: "Transferência entre contas da própria empresa (TED/PIX entre bancos do mesmo CNPJ)",
    erro: "classificar a entrada como receita e a saída como despesa",
    correto: "não é resultado: é movimentação patrimonial. Deve ficar fora do DRE (marcar como transferência).",
  },
  {
    caso: "Aporte ou empréstimo do sócio para a empresa",
    erro: "classificar como receita",
    correto: "é passivo (empréstimo) ou patrimônio líquido (aporte). Princípio da Entidade.",
  },
  {
    caso: "Retirada de lucro pelo sócio",
    erro: "classificar como despesa (salário/pró-labore)",
    correto: "distribuição de lucro reduz o PL; só o pró-labore é despesa.",
  },
  {
    caso: "Antecipação de recebível (troca de prazo por dinheiro hoje)",
    erro: "lançar o valor bruto como nova receita",
    correto: "a receita já foi reconhecida na venda; aqui só entra a TAXA como despesa/custo financeiro.",
  },
  {
    caso: "Estorno ou devolução de venda",
    erro: "lançar como despesa",
    correto: "é retificação da receita (reduz a própria receita do período).",
  },
  {
    caso: "Pagamento de fornecedor com juros por atraso",
    erro: "somar tudo no custo da mercadoria",
    correto: "principal vai para o custo/despesa original; o juro é despesa financeira (5.8).",
  },
  {
    caso: "DAS do Simples Nacional",
    erro: "tratar como despesa administrativa genérica",
    correto: "é tributo sobre faturamento (5.7). Ele embute vários tributos, mas contabilmente entra como imposto.",
  },
  {
    caso: "INSS e FGTS do funcionário",
    erro: "classificar como imposto (5.7)",
    correto: "é encargo de pessoal: acompanha o salário (5.2 estrutura, 4.2 produção).",
  },
] as const;

/* ------------------------------------------------------------------ */
/* 6. O texto que vai para o prompt                                    */
/* ------------------------------------------------------------------ */

/**
 * Doutrina condensada para o system prompt. Fica longo de propósito: é mais
 * barato pagar tokens de contexto do que consertar classificação errada no
 * fechamento — e erro contábil silencioso destrói a confiança no número.
 */
export function conhecimentoContabilParaPrompt(): string {
  const principios = PRINCIPIOS_CFC.map((p) => `- ${p.nome} (${p.norma}): ${p.regra}`).join("\n");
  const natureza = NATUREZA_DAS_CONTAS.map(
    (n) => `- ${n.codigo}: aceita ${n.aceita}${n.naoAceita ? `; NÃO aceita ${n.naoAceita}` : ""}`,
  ).join("\n");
  const armadilhas = ARMADILHAS.map((a) => `- ${a.caso}: NÃO ${a.erro}. Correto: ${a.correto}`).join("\n");
  const centros = CENTRO_DE_CUSTO_CRITERIO.mapa_tipico.map((c) => `- ${c.centro}: ${c.exemplos}`).join("\n");

  return `DOUTRINA CONTÁBIL BRASILEIRA (CFC) — obrigatória em toda decisão:

PRINCÍPIOS
${principios}

CUSTO x DESPESA (o erro mais caro)
${CUSTO_VS_DESPESA.regra}
Teste prático: ${CUSTO_VS_DESPESA.teste_pratico}
Base: ${CUSTO_VS_DESPESA.norma}

RÉGUA DO PLANO DE CONTAS
3.x = ${PLANO_DE_CONTAS_REGUA["3"]}
4.x = ${PLANO_DE_CONTAS_REGUA["4"]}
5.x = ${PLANO_DE_CONTAS_REGUA["5"]}

NATUREZA DE CADA CONTA
${natureza}

CENTRO DE CUSTO
${CENTRO_DE_CUSTO_CRITERIO.regra}
${centros}
${CENTRO_DE_CUSTO_CRITERIO.quando_deixar_nulo}

ARMADILHAS DO EXTRATO BRASILEIRO
${armadilhas}

REGRA DE OURO: na dúvida, devolva account_id nulo com confidence "low". Um lançamento a classificar é resolvido por um humano em segundos; um lançamento classificado errado vira número errado no DRE e ninguém percebe.`;
}

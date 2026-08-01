/**
 * Catálogo de "abrir o registro" — puro e testável.
 *
 * Regra de UX que o produto assume: TUDO que aparece na tela pode ser aberto.
 * Clicar numa linha de tabela, num ponto de gráfico ou num número de indicador
 * mostra o que aquilo é, quando nasceu, quem lançou, de onde veio e para onde
 * leva. Sem beco sem saída: todo detalhe oferece pelo menos um caminho adiante.
 *
 * Aqui mora só a DESCRIÇÃO (que tabela, que campos, como rotular). Quem busca
 * é useDetalheRegistro; quem desenha é DetalheRegistroDialog.
 */

export type TipoRegistro =
  | "transaction"
  | "receivable"
  | "bill"
  | "contract"
  | "sales_order"
  | "purchase_order"
  | "contact"
  | "product"
  | "account"
  | "cost_center"
  | "bank_raw"
  | "tax_guide";

export type FormatoCampo = "texto" | "moeda" | "data" | "datahora" | "percentual" | "status" | "numero";

export interface CampoDetalhe {
  /** Coluna na tabela (aceita caminho com ponto para relação: "contacts.name"). */
  key: string;
  label: string;
  formato?: FormatoCampo;
  /** Não mostra quando vazio (evita poluir com nulo). */
  ocultarSeVazio?: boolean;
}

export interface DefinicaoRegistro {
  tipo: TipoRegistro;
  /** Nome que aparece no cabeçalho do modal. */
  titulo: string;
  tabela: string;
  /** Colunas pedidas ao PostgREST (inclui relações). */
  select: string;
  /** Campo usado como título do registro. */
  campoTitulo: string;
  /** Campo usado como valor em destaque, quando faz sentido. */
  campoValor?: string;
  campos: CampoDetalhe[];
  /** Campo que guarda o link do documento original (nota, boleto, comprovante). */
  campoDocumento?: string;
  /** Rota para "abrir na tela cheia". */
  rotaLista?: string;
}

export const REGISTROS: Record<TipoRegistro, DefinicaoRegistro> = {
  transaction: {
    tipo: "transaction",
    titulo: "Lançamento",
    tabela: "transactions",
    select:
      "id, description, amount, type, status, date, competencia_date, source, payment_method, project, attachment_url, external_id, is_intercompany, created_at, updated_at, user_id, account_id, cost_center_id, contact_id, bank_account_id, chart_of_accounts(name, code, type), cost_centers(name), contacts(name), bank_accounts(name)",
    campoTitulo: "description",
    campoValor: "amount",
    campoDocumento: "attachment_url",
    rotaLista: "/transactions",
    campos: [
      { key: "amount", label: "Valor", formato: "moeda" },
      { key: "type", label: "Natureza", formato: "status" },
      { key: "status", label: "Situação", formato: "status" },
      { key: "date", label: "Data de caixa", formato: "data" },
      { key: "competencia_date", label: "Competência", formato: "data", ocultarSeVazio: true },
      { key: "chart_of_accounts.code", label: "Conta contábil", ocultarSeVazio: true },
      { key: "chart_of_accounts.name", label: "Nome da conta", ocultarSeVazio: true },
      { key: "cost_centers.name", label: "Centro de custo", ocultarSeVazio: true },
      { key: "contacts.name", label: "Cliente / fornecedor", ocultarSeVazio: true },
      { key: "bank_accounts.name", label: "Conta bancária", ocultarSeVazio: true },
      { key: "payment_method", label: "Forma de pagamento", ocultarSeVazio: true },
      { key: "source", label: "Origem do registro", formato: "status" },
      { key: "external_id", label: "Identificador externo", ocultarSeVazio: true },
      { key: "created_at", label: "Lançado em", formato: "datahora" },
      { key: "updated_at", label: "Última alteração", formato: "datahora", ocultarSeVazio: true },
    ],
  },
  receivable: {
    tipo: "receivable",
    titulo: "Conta a receber",
    tabela: "receivables",
    select:
      "id, description, amount, due_date, status, source, payment_date, parcela, parcelas_total, boleto_url, pix_url, external_id, created_at, updated_at, contact_id, transaction_id, contract_id, sales_order_id, contacts(name)",
    campoTitulo: "description",
    campoValor: "amount",
    campoDocumento: "boleto_url",
    rotaLista: "/receivables",
    campos: [
      { key: "amount", label: "Valor", formato: "moeda" },
      { key: "status", label: "Situação", formato: "status" },
      { key: "due_date", label: "Vencimento", formato: "data" },
      { key: "payment_date", label: "Recebido em", formato: "data", ocultarSeVazio: true },
      { key: "contacts.name", label: "Cliente", ocultarSeVazio: true },
      { key: "parcela", label: "Parcela", formato: "numero", ocultarSeVazio: true },
      { key: "parcelas_total", label: "Total de parcelas", formato: "numero", ocultarSeVazio: true },
      { key: "source", label: "Origem", formato: "status" },
      { key: "created_at", label: "Criado em", formato: "datahora" },
    ],
  },
  bill: {
    tipo: "bill",
    titulo: "Conta a pagar",
    tabela: "bills_payable",
    select:
      "id, descricao, fornecedor, valor, vencimento, status, source, approval_status, is_recurring, recurrence_index, recurrence_total, external_id, created_at, updated_at, contact_id, contacts(name)",
    campoTitulo: "descricao",
    campoValor: "valor",
    rotaLista: "/fiscal/contas-a-pagar",
    campos: [
      { key: "valor", label: "Valor", formato: "moeda" },
      { key: "status", label: "Situação", formato: "status" },
      { key: "vencimento", label: "Vencimento", formato: "data" },
      { key: "fornecedor", label: "Fornecedor", ocultarSeVazio: true },
      { key: "approval_status", label: "Aprovação", formato: "status", ocultarSeVazio: true },
      { key: "recurrence_index", label: "Ocorrência", formato: "numero", ocultarSeVazio: true },
      { key: "recurrence_total", label: "Total de ocorrências", formato: "numero", ocultarSeVazio: true },
      { key: "source", label: "Origem", formato: "status" },
      { key: "created_at", label: "Criado em", formato: "datahora" },
    ],
  },
  contract: {
    tipo: "contract",
    titulo: "Contrato",
    tabela: "contracts",
    select:
      "id, description, amount, cycle, status, billing_day, payment_method, start_date, end_date, next_due_date, indice_reajuste, proximo_reajuste, ultimo_reajuste_em, created_at, contact_id, contacts(name)",
    campoTitulo: "description",
    campoValor: "amount",
    rotaLista: "/contracts",
    campos: [
      { key: "amount", label: "Valor por ciclo", formato: "moeda" },
      { key: "cycle", label: "Ciclo", formato: "status" },
      { key: "status", label: "Situação", formato: "status" },
      { key: "contacts.name", label: "Cliente", ocultarSeVazio: true },
      { key: "billing_day", label: "Dia de cobrança", formato: "numero" },
      { key: "next_due_date", label: "Próxima cobrança", formato: "data", ocultarSeVazio: true },
      { key: "start_date", label: "Início", formato: "data" },
      { key: "end_date", label: "Término", formato: "data", ocultarSeVazio: true },
      { key: "indice_reajuste", label: "Índice de reajuste", ocultarSeVazio: true },
      { key: "proximo_reajuste", label: "Próximo reajuste", formato: "data", ocultarSeVazio: true },
      { key: "created_at", label: "Criado em", formato: "datahora" },
    ],
  },
  sales_order: {
    tipo: "sales_order",
    titulo: "Pedido de venda",
    tabela: "sales_orders",
    select:
      "id, order_number, status, issue_date, due_date, subtotal, discount_value, shipping, total, payment_method, salesperson, commission_value, notes, aceite_em, aceite_nome, estoque_baixado_em, created_at, user_id, contact_id, contacts(name)",
    campoTitulo: "order_number",
    campoValor: "total",
    rotaLista: "/sales",
    campos: [
      { key: "total", label: "Total", formato: "moeda" },
      { key: "status", label: "Situação", formato: "status" },
      { key: "issue_date", label: "Emissão", formato: "data" },
      { key: "due_date", label: "Vencimento", formato: "data", ocultarSeVazio: true },
      { key: "contacts.name", label: "Cliente", ocultarSeVazio: true },
      { key: "subtotal", label: "Subtotal", formato: "moeda", ocultarSeVazio: true },
      { key: "discount_value", label: "Desconto", formato: "moeda", ocultarSeVazio: true },
      { key: "salesperson", label: "Vendedor", ocultarSeVazio: true },
      { key: "aceite_em", label: "Aceite do cliente", formato: "datahora", ocultarSeVazio: true },
      { key: "estoque_baixado_em", label: "Baixa de estoque", formato: "datahora", ocultarSeVazio: true },
      { key: "created_at", label: "Criado em", formato: "datahora" },
    ],
  },
  purchase_order: {
    tipo: "purchase_order",
    titulo: "Pedido de compra",
    tabela: "purchase_orders",
    select: "id, order_number, status, issue_date, total, notes, created_at, contact_id, contacts(name)",
    campoTitulo: "order_number",
    campoValor: "total",
    rotaLista: "/purchases",
    campos: [
      { key: "total", label: "Total", formato: "moeda" },
      { key: "status", label: "Situação", formato: "status" },
      { key: "issue_date", label: "Emissão", formato: "data" },
      { key: "contacts.name", label: "Fornecedor", ocultarSeVazio: true },
      { key: "created_at", label: "Criado em", formato: "datahora" },
    ],
  },
  contact: {
    tipo: "contact",
    titulo: "Cliente / fornecedor",
    tabela: "contacts",
    select:
      "id, name, trade_name, type, person_type, document, email, phone, whatsapp, city, state, credit_limit, default_payment_terms, active, notes, created_at",
    campoTitulo: "name",
    rotaLista: "/contacts",
    campos: [
      { key: "document", label: "CNPJ / CPF", ocultarSeVazio: true },
      { key: "type", label: "Tipo", formato: "status" },
      { key: "email", label: "E-mail", ocultarSeVazio: true },
      { key: "phone", label: "Telefone", ocultarSeVazio: true },
      { key: "whatsapp", label: "WhatsApp", ocultarSeVazio: true },
      { key: "city", label: "Cidade", ocultarSeVazio: true },
      { key: "credit_limit", label: "Limite de crédito", formato: "moeda", ocultarSeVazio: true },
      { key: "default_payment_terms", label: "Prazo padrão (dias)", formato: "numero", ocultarSeVazio: true },
      { key: "created_at", label: "Cadastrado em", formato: "datahora" },
    ],
  },
  product: {
    tipo: "product",
    titulo: "Produto / serviço",
    tabela: "products",
    select:
      "id, name, sku, barcode, type, unit, sell_price, cost_price, average_cost, current_stock, min_stock, ncm, cfop, cclasstrib, category, active, created_at",
    campoTitulo: "name",
    campoValor: "sell_price",
    rotaLista: "/products",
    campos: [
      { key: "sell_price", label: "Preço de venda", formato: "moeda" },
      { key: "cost_price", label: "Custo", formato: "moeda", ocultarSeVazio: true },
      { key: "average_cost", label: "Custo médio", formato: "moeda", ocultarSeVazio: true },
      { key: "current_stock", label: "Estoque atual", formato: "numero", ocultarSeVazio: true },
      { key: "min_stock", label: "Estoque mínimo", formato: "numero", ocultarSeVazio: true },
      { key: "sku", label: "SKU", ocultarSeVazio: true },
      { key: "barcode", label: "Código de barras", ocultarSeVazio: true },
      { key: "ncm", label: "NCM", ocultarSeVazio: true },
      { key: "cfop", label: "CFOP", ocultarSeVazio: true },
      { key: "created_at", label: "Cadastrado em", formato: "datahora" },
    ],
  },
  account: {
    tipo: "account",
    titulo: "Conta contábil",
    tabela: "chart_of_accounts",
    select: "id, name, code, type, group_code, group_name, editable, created_at",
    campoTitulo: "name",
    rotaLista: "/settings/chart-of-accounts",
    campos: [
      { key: "code", label: "Código" },
      { key: "type", label: "Natureza", formato: "status" },
      { key: "group_code", label: "Grupo de consolidação", ocultarSeVazio: true },
      { key: "created_at", label: "Criada em", formato: "datahora" },
    ],
  },
  cost_center: {
    tipo: "cost_center",
    titulo: "Centro de custo",
    tabela: "cost_centers",
    select: "id, name, category, active, created_at",
    campoTitulo: "name",
    rotaLista: "/settings/cost-centers",
    campos: [
      { key: "category", label: "Categoria", formato: "status" },
      { key: "created_at", label: "Criado em", formato: "datahora" },
    ],
  },
  bank_raw: {
    tipo: "bank_raw",
    titulo: "Lançamento do extrato",
    tabela: "bank_transactions_raw",
    select:
      "id, description, amount, direction, date, status, provider, external_id, account_external_id, transaction_id, created_at",
    campoTitulo: "description",
    campoValor: "amount",
    rotaLista: "/bank-inbox",
    campos: [
      { key: "amount", label: "Valor", formato: "moeda" },
      { key: "direction", label: "Natureza", formato: "status" },
      { key: "date", label: "Data", formato: "data" },
      { key: "status", label: "Situação", formato: "status" },
      { key: "provider", label: "Provedor", formato: "status" },
      { key: "external_id", label: "Identificador no banco", ocultarSeVazio: true },
      { key: "created_at", label: "Importado em", formato: "datahora" },
    ],
  },
  tax_guide: {
    tipo: "tax_guide",
    titulo: "Guia de imposto",
    tabela: "tax_guides",
    select: "id, tipo, competencia, valor, vencimento, status, source, created_at",
    campoTitulo: "tipo",
    campoValor: "valor",
    rotaLista: "/fiscal/impostos",
    campos: [
      { key: "valor", label: "Valor", formato: "moeda" },
      { key: "competencia", label: "Competência" },
      { key: "vencimento", label: "Vencimento", formato: "data" },
      { key: "status", label: "Situação", formato: "status" },
      { key: "created_at", label: "Criada em", formato: "datahora" },
    ],
  },
};

/** Lê "a.b.c" dentro do objeto devolvido pelo PostgREST. */
export function valorNoCaminho(registro: Record<string, unknown> | null, caminho: string): unknown {
  if (!registro) return null;
  return caminho.split(".").reduce<unknown>((atual, parte) => {
    if (atual == null || typeof atual !== "object") return null;
    return (atual as Record<string, unknown>)[parte];
  }, registro);
}

/** Rótulos legíveis para os enums que aparecem em `status`. */
const ROTULOS: Record<string, string> = {
  revenue: "Receita", expense: "Despesa",
  confirmed: "Confirmado", pending: "Pendente", reconciled: "Conciliado", cancelled: "Cancelado",
  a_receber: "A receber", recebido: "Recebido", vencido: "Vencido", cancelado: "Cancelado",
  pendente: "Pendente", pago: "Pago", paid: "Pago",
  manual: "Manual", openfinance: "Open Finance", contrato: "Contrato", pedido: "Pedido",
  asaas: "Asaas", pdv: "Frente de caixa", contaazul: "Conta Azul", mcp: "Integração",
  reconciled_source: "Conciliado", new: "Novo", imported: "Importado", ignored: "Ignorado", matched: "Conciliado",
  draft: "Rascunho", quote: "Orçamento", invoiced: "Faturado", delivered: "Entregue",
  active: "Ativo", paused: "Pausado", ended: "Encerrado",
  MONTHLY: "Mensal", WEEKLY: "Semanal", BIWEEKLY: "Quinzenal", QUARTERLY: "Trimestral",
  SEMIANNUALLY: "Semestral", YEARLY: "Anual",
  customer: "Cliente", supplier: "Fornecedor", both: "Cliente e fornecedor",
  product: "Produto", service: "Serviço", department: "Departamento",
  approved: "Aprovado", awaiting_approval: "Aguardando aprovação", rejected: "Recusado",
  pluggy: "Pluggy", belvo: "Belvo",
};

export function rotularValor(valor: unknown): string {
  const chave = String(valor ?? "");
  return ROTULOS[chave] ?? chave;
}

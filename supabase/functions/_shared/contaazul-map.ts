/**
 * Mapeadores Conta Azul (API v2) → FinanceAI. Puros e defensivos: a doc da
 * API evolui e os nomes de campo variam entre recursos, então cada mapper
 * aceita os aliases conhecidos e devolve null quando o registro não tem o
 * mínimo — importar lixo é pior que pular e reportar.
 *
 * Dedupe: todo registro importado carrega external_id `ca:<uuid>`; quem já
 * existe com o mesmo external_id é atualizado ou pulado, nunca duplicado.
 */

type Registro = Record<string, unknown>;

const s = (v: unknown): string | null => (typeof v === "string" && v.trim() !== "" ? v.trim() : null);
const n = (v: unknown): number | null => {
  const num = typeof v === "string" ? Number(v) : typeof v === "number" ? v : NaN;
  return Number.isFinite(num) ? num : null;
};
const dataIso = (v: unknown): string | null => {
  const str = s(v);
  if (!str) return null;
  const soData = str.slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(soData) ? soData : null;
};

export const externalId = (recurso: string, id: unknown): string | null => {
  const idStr = s(id);
  return idStr ? `ca:${recurso}:${idStr}` : null;
};

export interface ContactImport {
  external_id: string;
  name: string;
  document: string | null;
  email: string | null;
  phone: string | null;
  type: "customer" | "supplier";
}

export function mapPessoa(ca: Registro): ContactImport | null {
  const id = externalId("pessoa", ca.id ?? ca.uuid);
  const name = s(ca.nome) ?? s(ca.razao_social) ?? s(ca.nome_fantasia) ?? s(ca.name);
  if (!id || !name) return null;
  const perfis = Array.isArray(ca.perfis) ? ca.perfis.map((p) => String(p).toUpperCase()) : [];
  const perfilUnico = s(ca.tipo_perfil)?.toUpperCase();
  const ehFornecedor = perfis.includes("FORNECEDOR") || perfilUnico === "FORNECEDOR";
  return {
    external_id: id,
    name,
    document: s(ca.documento) ?? s(ca.cpf_cnpj) ?? s(ca.cnpj) ?? s(ca.cpf),
    email: s(ca.email),
    phone: s(ca.telefone) ?? s(ca.celular),
    type: ehFornecedor ? "supplier" : "customer",
  };
}

export interface ProductImport {
  external_id: string;
  name: string;
  sku: string | null;
  sell_price: number;
  cost_price: number | null;
  type: "product" | "service";
}

export function mapProduto(ca: Registro): ProductImport | null {
  const id = externalId("produto", ca.id ?? ca.uuid);
  const name = s(ca.nome) ?? s(ca.descricao) ?? s(ca.name);
  if (!id || !name) return null;
  return {
    external_id: id,
    name,
    sku: s(ca.codigo) ?? s(ca.codigo_sku) ?? s(ca.sku),
    sell_price: n(ca.valor_venda) ?? n(ca.preco) ?? n(ca.valor) ?? 0,
    cost_price: n(ca.custo) ?? n(ca.valor_custo),
    type: "product",
  };
}

export function mapServico(ca: Registro): ProductImport | null {
  const id = externalId("servico", ca.id ?? ca.uuid);
  const name = s(ca.nome) ?? s(ca.descricao) ?? s(ca.name);
  if (!id || !name) return null;
  return {
    external_id: id,
    name,
    sku: s(ca.codigo),
    sell_price: n(ca.valor_venda) ?? n(ca.preco) ?? n(ca.valor) ?? 0,
    cost_price: null,
    type: "service",
  };
}

export interface ReceivableImport {
  external_id: string;
  description: string;
  amount: number;
  due_date: string;
  status: "a_receber" | "recebido";
  payment_date: string | null;
}

const SITUACOES_RECEBIDO = new Set(["RECEBIDO", "PAGO", "QUITADO", "LIQUIDADO", "CONCILIADO"]);

export function mapContaReceber(ca: Registro): ReceivableImport | null {
  const id = externalId("receber", ca.id ?? ca.uuid);
  const amount = n(ca.valor) ?? n(ca.total) ?? n(ca.valor_total);
  const due = dataIso(ca.data_vencimento) ?? dataIso(ca.vencimento);
  if (!id || amount === null || amount <= 0 || !due) return null;
  const situacao = (s(ca.situacao) ?? s(ca.status) ?? "").toUpperCase();
  const recebido = SITUACOES_RECEBIDO.has(situacao);
  return {
    external_id: id,
    description: s(ca.descricao) ?? s(ca.historico) ?? "Importado do Conta Azul",
    amount,
    due_date: due,
    status: recebido ? "recebido" : "a_receber",
    payment_date: recebido ? (dataIso(ca.data_pagamento) ?? dataIso(ca.data_quitacao) ?? due) : null,
  };
}

export interface BillImport {
  external_id: string;
  fornecedor: string;
  descricao: string;
  valor: number;
  vencimento: string;
  status: "pendente" | "pago";
}

export function mapContaPagar(ca: Registro): BillImport | null {
  const id = externalId("pagar", ca.id ?? ca.uuid);
  const valor = n(ca.valor) ?? n(ca.total) ?? n(ca.valor_total);
  const venc = dataIso(ca.data_vencimento) ?? dataIso(ca.vencimento);
  if (!id || valor === null || valor <= 0 || !venc) return null;
  const situacao = (s(ca.situacao) ?? s(ca.status) ?? "").toUpperCase();
  const fornecedorObj = (ca.fornecedor ?? ca.pessoa) as Registro | undefined;
  return {
    external_id: id,
    fornecedor: s(fornecedorObj?.nome) ?? s(ca.nome_fornecedor) ?? "Fornecedor (Conta Azul)",
    descricao: s(ca.descricao) ?? s(ca.historico) ?? "Importado do Conta Azul",
    valor,
    vencimento: venc,
    status: SITUACOES_RECEBIDO.has(situacao) ? "pago" : "pendente",
  };
}

export interface ResumoImport {
  mapeados: number;
  pulados: number;
}

/** Aplica um mapper numa lista crua, separando o que entra do que foi pulado. */
export function mapearLote<T>(itens: unknown, mapper: (r: Registro) => T | null): { validos: T[]; resumo: ResumoImport } {
  const lista = Array.isArray(itens) ? itens : [];
  const validos: T[] = [];
  let pulados = 0;
  for (const item of lista) {
    const mapeado = item && typeof item === "object" ? mapper(item as Registro) : null;
    if (mapeado) validos.push(mapeado);
    else pulados += 1;
  }
  return { validos, resumo: { mapeados: validos.length, pulados } };
}

/**
 * PlugNotas helpers: domain types, mappers para o payload PlugNotas,
 * validações de CPF/CNPJ e geração de idIntegracao.
 *
 * Os mappers convertem a estrutura "amigável" dos forms para o JSON
 * que o PlugNotas espera. Centralizado aqui para os forms ficarem
 * focados em UX e não em mapeamento.
 */

import {
  montarGrupoIbsCbs,
  regimeDestacaEm,
  docExigeDestaque,
  type GrupoIbsCbs,
  type RegimeTributario,
} from "./reforma";

export type PlugnotasDocType = "nfse" | "nfe" | "nfce" | "cte" | "mdfe";

export const DOC_LABEL: Record<PlugnotasDocType, string> = {
  nfse: "NFS-e",
  nfe: "NF-e",
  nfce: "NFC-e",
  cte: "CT-e",
  mdfe: "MDF-e",
};

export const DOC_FUNCTION: Record<PlugnotasDocType, string> = {
  nfse: "plugnotas-nfse",
  nfe: "plugnotas-nfe",
  nfce: "plugnotas-nfce",
  cte: "plugnotas-cte",
  mdfe: "plugnotas-mdfe",
};

export function newIdIntegracao(prefix: PlugnotasDocType): string {
  const stamp = new Date().toISOString().replace(/[^0-9]/g, "").slice(0, 14);
  const rnd = Math.random().toString(36).slice(2, 8);
  return `${prefix}-${stamp}-${rnd}`;
}

// ---------- Document validation ----------

function onlyDigits(s: string): string {
  return s.replace(/\D/g, "");
}

export function isValidCNPJ(raw: string): boolean {
  const cnpj = onlyDigits(raw);
  if (cnpj.length !== 14 || /^(\d)\1{13}$/.test(cnpj)) return false;
  const calc = (slice: string, base: number) => {
    let sum = 0;
    for (let i = 0; i < slice.length; i++) {
      sum += parseInt(slice[i]) * (base - i);
      base = base === 9 ? 9 : base - 1;
    }
    const r = sum % 11;
    return r < 2 ? 0 : 11 - r;
  };
  // Standard CNPJ check digits
  const base12 = cnpj.slice(0, 12);
  let sum = 0;
  const w1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  for (let i = 0; i < 12; i++) sum += parseInt(base12[i]) * w1[i];
  const d1 = sum % 11 < 2 ? 0 : 11 - (sum % 11);
  sum = 0;
  const w2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  for (let i = 0; i < 13; i++) sum += parseInt((base12 + d1)[i]) * w2[i];
  const d2 = sum % 11 < 2 ? 0 : 11 - (sum % 11);
  return cnpj.endsWith(`${d1}${d2}`);
}

export function isValidCPF(raw: string): boolean {
  const cpf = onlyDigits(raw);
  if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false;
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += parseInt(cpf[i]) * (10 - i);
  let r = (sum * 10) % 11;
  if (r === 10) r = 0;
  if (r !== parseInt(cpf[9])) return false;
  sum = 0;
  for (let i = 0; i < 10; i++) sum += parseInt(cpf[i]) * (11 - i);
  r = (sum * 10) % 11;
  if (r === 10) r = 0;
  return r === parseInt(cpf[10]);
}

export function isValidDocument(raw: string): boolean {
  const digits = onlyDigits(raw);
  if (digits.length === 11) return isValidCPF(digits);
  if (digits.length === 14) return isValidCNPJ(digits);
  return false;
}

export function formatDocument(raw: string | null | undefined): string {
  if (!raw) return "";
  const d = onlyDigits(raw);
  if (d.length === 11) return d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
  if (d.length === 14) return d.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
  return raw;
}

// ---------- Shared domain types ----------

export interface DomainContact {
  cpfCnpj: string;
  razaoSocial: string;
  nomeFantasia?: string;
  inscricaoEstadual?: string;
  email?: string;
  telefone?: string;
  endereco?: {
    logradouro?: string;
    numero?: string;
    complemento?: string;
    bairro?: string;
    municipio?: string;
    uf?: string;
    cep?: string;
  };
}

export interface NfseFormData {
  prestadorCnpj: string;
  inscricaoMunicipal?: string;
  tomador: DomainContact;
  servico: {
    codigoTributacaoMunicipio: string;
    itemListaServico: string;
    cnae?: string;
    discriminacao: string;
    valorServico: number;
    aliquotaIss?: number;
    issRetido?: boolean;
  };
  observacoes?: string;
  competencia?: string; // YYYY-MM-DD
}

export interface NfeItem {
  codigo: string;
  descricao: string;
  ncm: string;
  cfop: string;
  unidade: string;
  quantidade: number;
  valorUnitario: number;
  origemTributaria?: string;
  /** cClassTrib do produto — sobrepõe o padrão da empresa no destaque CBS/IBS. */
  cClassTrib?: string;
}

export interface NfeFormData {
  emitenteCnpj: string;
  destinatario: DomainContact;
  naturezaOperacao: string;
  itens: NfeItem[];
  informacoesAdicionais?: string;
}

export interface NfceFormData extends NfeFormData {
  consumidorFinal: boolean;
  formaPagamento: string;
  valorPago?: number;
}

export interface CteFormData {
  emitenteCnpj: string;
  naturezaOperacao: string;
  modal: string;
  remetente: DomainContact;
  destinatario: DomainContact;
  tomador: "remetente" | "destinatario" | "expedidor" | "recebedor" | "outros";
  valorTotal: number;
  pesoBruto: number;
  origemMunicipio: string;
  destinoMunicipio: string;
  observacoes?: string;
}

export interface MdfeFormData {
  emitenteCnpj: string;
  modal: string;
  ufOrigem: string;
  ufDestino: string;
  veiculoPlaca: string;
  documentosVinculados: string[];
  pesoBruto: number;
  observacoes?: string;
}

// ---------- Reforma Tributária (CBS/IBS) ----------

/**
 * Opções de destaque CBS/IBS aplicadas pelos mappers.
 * `deveDestacar` decide a partir do regime da empresa e do tipo de documento.
 */
export interface ReformaOpts {
  cClassTrib?: string;
}

export function deveDestacar(
  regime: RegimeTributario | null | undefined,
  doc: PlugnotasDocType,
  ano = new Date().getFullYear(),
): boolean {
  if (!regime) return false;
  return docExigeDestaque(doc) && regimeDestacaEm(regime, ano);
}

/**
 * Grupo IBS/CBS no formato REAL do PlugNotas (schema `ibscbsNfe`, api.json
 * v2.4.2, exige esquema pl_010b): vai em `itens[].tributos.ibscbs`, com IBS
 * separado em uf (0,1% em 2026) e municipio (0%). ÚNICO ponto que conhece as
 * chaves do payload.
 */
export function ibsCbsPayloadGroup(g: GrupoIbsCbs) {
  return {
    cst: g.cst,
    classificacao: g.cClassTrib,
    baseCalculo: g.baseCalculo,
    uf: { aliquota: g.ibsUfAliquota, valor: g.ibsUfValor },
    municipio: { aliquota: g.ibsMunAliquota, valor: g.ibsMunValor },
    cbs: { aliquota: g.cbsAliquota, valor: g.cbsValor },
  };
}

/** Metadados de destaque para persistência em plugnotas_documents (snake_case = colunas). */
export function reformaDbMeta(g: GrupoIbsCbs) {
  return {
    cbs_valor: g.cbsValor,
    ibs_valor: g.ibsValor,
    cbs_aliquota: g.cbsAliquota,
    ibs_aliquota: g.ibsAliquota,
    cclasstrib: g.cClassTrib,
  };
}

/**
 * Extrai do payload já mapeado (NFe/NFCe) os metadados de destaque para a
 * edge function persistir em plugnotas_documents. Soma os grupos por item.
 * Undefined se nenhum item tem destaque.
 */
export function extractReformaMeta(payload: unknown): ReturnType<typeof reformaDbMeta> | undefined {
  const itens = (payload as {
    itens?: Array<{ tributos?: { ibscbs?: ReturnType<typeof ibsCbsPayloadGroup> } }>;
  }).itens;
  const grupos = (itens ?? [])
    .map((it) => it.tributos?.ibscbs)
    .filter((g): g is ReturnType<typeof ibsCbsPayloadGroup> => Boolean(g));
  if (grupos.length === 0) return undefined;
  const sum = (get: (g: ReturnType<typeof ibsCbsPayloadGroup>) => number) =>
    Math.round(grupos.reduce((acc, g) => acc + get(g), 0) * 100) / 100;
  return {
    cbs_valor: sum((g) => g.cbs.valor),
    ibs_valor: sum((g) => g.uf.valor + g.municipio.valor),
    cbs_aliquota: grupos[0].cbs.aliquota,
    ibs_aliquota: grupos[0].uf.aliquota + grupos[0].municipio.aliquota,
    cclasstrib: grupos[0].classificacao,
  };
}

// ---------- Mappers ----------

function digits(s: string) { return s.replace(/\D/g, ""); }

// NFS-e via PlugNotas usa schema RTC próprio (`servico[].ibscbs` com
// finalidadeNFSe/codigoOperacao/valores) e Simples só destaca em 2027 —
// grupo NÃO anexado por ora; via primária de NFS-e é o Emissor Nacional.
export function mapNfse(d: NfseFormData, _reforma?: ReformaOpts | null) {
  return {
    idIntegracao: newIdIntegracao("nfse"),
    prestador: {
      cpfCnpj: digits(d.prestadorCnpj),
      inscricaoMunicipal: d.inscricaoMunicipal || undefined,
    },
    tomador: {
      cpfCnpj: digits(d.tomador.cpfCnpj),
      razaoSocial: d.tomador.razaoSocial,
      ...(d.tomador.email && { email: d.tomador.email }),
      ...(d.tomador.endereco && { endereco: d.tomador.endereco }),
    },
    servico: {
      codigoTributacaoMunicipio: d.servico.codigoTributacaoMunicipio,
      itemListaServico: d.servico.itemListaServico,
      ...(d.servico.cnae && { cnae: d.servico.cnae }),
      discriminacao: d.servico.discriminacao,
      issRetido: d.servico.issRetido ?? false,
      valor: {
        servico: d.servico.valorServico,
        ...(d.servico.aliquotaIss != null && { aliquotaIss: d.servico.aliquotaIss }),
      },
    },
    ...(d.observacoes && { informacoesComplementares: d.observacoes }),
    ...(d.competencia && { competencia: d.competencia }),
  };
}

export function mapNfe(d: NfeFormData, reforma?: ReformaOpts | null) {
  const total = d.itens.reduce((s, it) => s + it.quantidade * it.valorUnitario, 0);
  return {
    idIntegracao: newIdIntegracao("nfe"),
    natureza: d.naturezaOperacao,
    emitente: { cpfCnpj: digits(d.emitenteCnpj) },
    destinatario: {
      cpfCnpj: digits(d.destinatario.cpfCnpj),
      razaoSocial: d.destinatario.razaoSocial,
      ...(d.destinatario.inscricaoEstadual && { inscricaoEstadual: d.destinatario.inscricaoEstadual }),
      ...(d.destinatario.email && { email: d.destinatario.email }),
      ...(d.destinatario.endereco && { endereco: d.destinatario.endereco }),
    },
    itens: d.itens.map((it, idx) => {
      const itemTotal = +(it.quantidade * it.valorUnitario).toFixed(2);
      const grupoItem = reforma ? montarGrupoIbsCbs(itemTotal, it.cClassTrib || reforma.cClassTrib) : null;
      return {
        numeroItem: idx + 1,
        codigo: it.codigo,
        descricao: it.descricao,
        ncm: it.ncm,
        cfop: it.cfop,
        unidade: it.unidade,
        quantidade: it.quantidade,
        valorUnitario: it.valorUnitario,
        valorTotal: itemTotal,
        ...(it.origemTributaria && { origemTributaria: it.origemTributaria }),
        ...(grupoItem && { tributos: { ibscbs: ibsCbsPayloadGroup(grupoItem) } }),
      };
    }),
    totais: { valorTotal: +total.toFixed(2) },
    ...(d.informacoesAdicionais && { informacoesAdicionais: d.informacoesAdicionais }),
  };
}

export function mapNfce(d: NfceFormData, reforma?: ReformaOpts | null) {
  const base = mapNfe(d, reforma);
  return {
    ...base,
    idIntegracao: newIdIntegracao("nfce"),
    consumidorFinal: d.consumidorFinal,
    pagamento: {
      formaPagamento: d.formaPagamento,
      ...(d.valorPago != null && { valorPago: d.valorPago }),
    },
  };
}

// ATENÇÃO: o PlugNotas NÃO possui endpoint /cte (confirmado na spec api.json
// v2.4.2) — a emissão de CT-e por esta via não funciona; NT 2025.001 exigiria
// outro provedor (Componentes Tecnospeed). Mapper mantido para histórico/UI.
export function mapCte(d: CteFormData, _reforma?: ReformaOpts | null) {
  return {
    idIntegracao: newIdIntegracao("cte"),
    natureza: d.naturezaOperacao,
    modal: d.modal,
    emitente: { cpfCnpj: digits(d.emitenteCnpj) },
    remetente: {
      cpfCnpj: digits(d.remetente.cpfCnpj),
      razaoSocial: d.remetente.razaoSocial,
    },
    destinatario: {
      cpfCnpj: digits(d.destinatario.cpfCnpj),
      razaoSocial: d.destinatario.razaoSocial,
    },
    tomador: d.tomador,
    prestacao: { valor: d.valorTotal },
    carga: { pesoBruto: d.pesoBruto },
    origem: { municipio: d.origemMunicipio },
    destino: { municipio: d.destinoMunicipio },
    ...(d.observacoes && { observacoes: d.observacoes }),
  };
}

export function mapMdfe(d: MdfeFormData) {
  return {
    idIntegracao: newIdIntegracao("mdfe"),
    modal: d.modal,
    emitente: { cpfCnpj: digits(d.emitenteCnpj) },
    percurso: { ufOrigem: d.ufOrigem, ufDestino: d.ufDestino },
    veiculo: { placa: d.veiculoPlaca },
    documentos: d.documentosVinculados.map((chave) => ({ chave })),
    carga: { pesoBruto: d.pesoBruto },
    ...(d.observacoes && { observacoes: d.observacoes }),
  };
}

// ---------- Pretty-print API errors ----------

export function extractErrorMessage(data: unknown): string {
  if (!data) return "Erro desconhecido";
  const obj = data as Record<string, unknown>;
  const err = obj.error as Record<string, unknown> | undefined;
  if (typeof err?.message === "string") return err.message;
  if (typeof obj.message === "string") return obj.message;
  return JSON.stringify(data).slice(0, 200);
}

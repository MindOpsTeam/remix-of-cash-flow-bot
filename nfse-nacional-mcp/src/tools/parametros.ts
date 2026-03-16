/**
 * Tools de parâmetros: nfse_parametros_municipio, nfse_parametros_contribuinte,
 * nfse_cnc_consultar, nfse_codigos_servico
 */

import type { AdnHttpClient } from "../auth/http-client.js";
import { parametrosCache } from "../cache/parametros-cache.js";
import { NfseValidationError } from "../errors/nfse-errors.js";

export async function nfseParametrosMunicipio(
  client: AdnHttpClient,
  params: {
    codigoMunicipio: string;
    cpfCnpj?: string;
  },
): Promise<{
  codigoMunicipio: string;
  nomeMunicipio?: string;
  aderenteAdn: boolean;
  aliquotaMinima?: number;
  aliquotaMaxima?: number;
  regimesEspeciais?: string[];
  beneficiosFiscais?: Array<{ codigo: string; descricao: string }>;
  retencoesobrigatorias?: string[];
}> {
  if (!params.codigoMunicipio || params.codigoMunicipio.length !== 7) {
    throw new NfseValidationError([{
      field: "codigoMunicipio",
      message: "Código IBGE deve ter 7 dígitos",
    }]);
  }

  const cacheKey = `param_mun_${params.codigoMunicipio}`;
  const cached = parametrosCache.get<Record<string, unknown>>(cacheKey);
  if (cached) {
    return cached as any;
  }

  const queryParams = params.cpfCnpj
    ? `?codigoMunicipio=${params.codigoMunicipio}&cpfCnpj=${params.cpfCnpj}`
    : `?codigoMunicipio=${params.codigoMunicipio}`;

  const response = await client.getJson(`/parametrizacao/municipios${queryParams}`);
  const data = JSON.parse(response.body);

  const result = {
    codigoMunicipio: params.codigoMunicipio,
    nomeMunicipio: data.nomeMunicipio || data.nome,
    aderenteAdn: data.aderente !== false,
    aliquotaMinima: data.aliquotaMinima ?? data.aliqMinima,
    aliquotaMaxima: data.aliquotaMaxima ?? data.aliqMaxima,
    regimesEspeciais: data.regimesEspeciais || [],
    beneficiosFiscais: data.beneficios || [],
    retencoesobrigatorias: data.retencoes || [],
  };

  parametrosCache.set(cacheKey, result);
  return result;
}

export async function nfseParametrosContribuinte(
  client: AdnHttpClient,
  params: {
    codigoMunicipio: string;
    cpfCnpj: string;
  },
): Promise<{
  cpfCnpj: string;
  codigoMunicipio: string;
  inscricaoMunicipal?: string;
  optanteSimplesNacional?: boolean;
  regimeEspecial?: string;
  beneficiosFiscais?: Array<{ codigo: string; descricao: string; aliquota?: number }>;
  aliquotaIss?: number;
}> {
  if (!params.cpfCnpj) {
    throw new NfseValidationError([{ field: "cpfCnpj", message: "CPF/CNPJ é obrigatório" }]);
  }
  if (!params.codigoMunicipio || params.codigoMunicipio.length !== 7) {
    throw new NfseValidationError([{ field: "codigoMunicipio", message: "Código IBGE deve ter 7 dígitos" }]);
  }

  const cacheKey = `param_contrib_${params.cpfCnpj}_${params.codigoMunicipio}`;
  const cached = parametrosCache.get<Record<string, unknown>>(cacheKey);
  if (cached) return cached as any;

  const response = await client.getJson(
    `/contribuintes/parametros?cpfCnpj=${params.cpfCnpj}&codigoMunicipio=${params.codigoMunicipio}`,
  );
  const data = JSON.parse(response.body);

  const result = {
    cpfCnpj: params.cpfCnpj,
    codigoMunicipio: params.codigoMunicipio,
    inscricaoMunicipal: data.inscricaoMunicipal || data.IM,
    optanteSimplesNacional: data.optanteSN ?? data.simplesNacional,
    regimeEspecial: data.regimeEspecial,
    beneficiosFiscais: data.beneficios || [],
    aliquotaIss: data.aliquotaIss ?? data.aliqISS,
  };

  parametrosCache.set(cacheKey, result, 12 * 60 * 60 * 1000); // 12h TTL for contributor params
  return result;
}

export async function nfseCncConsultar(
  client: AdnHttpClient,
  params: {
    cpfCnpj: string;
    codigoMunicipio?: string;
  },
): Promise<{
  cpfCnpj: string;
  razaoSocial?: string;
  nomeFantasia?: string;
  situacaoCadastral?: string;
  inscricoesMunicipais?: Array<{
    codigoMunicipio: string;
    nomeMunicipio?: string;
    inscricaoMunicipal: string;
    situacao: string;
  }>;
}> {
  if (!params.cpfCnpj) {
    throw new NfseValidationError([{ field: "cpfCnpj", message: "CPF/CNPJ é obrigatório" }]);
  }

  const query = params.codigoMunicipio
    ? `?cpfCnpj=${params.cpfCnpj}&codigoMunicipio=${params.codigoMunicipio}`
    : `?cpfCnpj=${params.cpfCnpj}`;

  const response = await client.getJson(`/cnc/contribuinte${query}`);
  const data = JSON.parse(response.body);

  return {
    cpfCnpj: params.cpfCnpj,
    razaoSocial: data.razaoSocial || data.nome,
    nomeFantasia: data.nomeFantasia,
    situacaoCadastral: data.situacao || data.situacaoCadastral,
    inscricoesMunicipais: data.inscricoes || data.inscricoesMunicipais || [],
  };
}

/**
 * Códigos de tributação nacional da LC 116/2003
 * Em produção, esses dados viriam da API de parametrização.
 * Aqui mantemos um subset para pesquisa offline.
 */
const CODIGOS_SERVICO_SUBSET: Array<{ codigo: string; descricao: string; grupo: string }> = [
  { codigo: "01.01.01", descricao: "Análise e desenvolvimento de sistemas", grupo: "Informática" },
  { codigo: "01.01.02", descricao: "Programação", grupo: "Informática" },
  { codigo: "01.01.03", descricao: "Processamento de dados e congêneres", grupo: "Informática" },
  { codigo: "01.01.04", descricao: "Elaboração de programas de computadores", grupo: "Informática" },
  { codigo: "01.01.05", descricao: "Licenciamento ou cessão de direito de uso de programas de computação", grupo: "Informática" },
  { codigo: "01.01.06", descricao: "Assessoria e consultoria em informática", grupo: "Informática" },
  { codigo: "01.01.07", descricao: "Suporte técnico em informática, inclusive instalação, configuração e manutenção de programas e bancos de dados", grupo: "Informática" },
  { codigo: "01.01.08", descricao: "Planejamento, confecção, manutenção e atualização de páginas eletrônicas", grupo: "Informática" },
  { codigo: "07.02.01", descricao: "Execução, por administração, empreitada ou subempreitada, de obras de construção civil", grupo: "Construção Civil" },
  { codigo: "17.01.01", descricao: "Assessoria ou consultoria de qualquer natureza", grupo: "Apoio Técnico" },
  { codigo: "17.02.01", descricao: "Datilografia, digitação, estenografia, expediente, secretaria em geral", grupo: "Apoio Técnico" },
  { codigo: "17.04.01", descricao: "Recrutamento, agenciamento, seleção e colocação de mão de obra", grupo: "Apoio Técnico" },
  { codigo: "25.01.01", descricao: "Funerais, inclusive fornecimento de caixão, urna ou esquife", grupo: "Funerários" },
  { codigo: "14.01.01", descricao: "Lubrificação, limpeza, lustração, revisão, carga e recarga, conserto, restauração, blindagem, manutenção e conservação de máquinas", grupo: "Manutenção" },
];

export async function nfseCodigosServico(
  client: AdnHttpClient,
  params: {
    busca?: string;
    codigo?: string;
  },
): Promise<{
  total: number;
  codigos: Array<{ codigo: string; descricao: string; grupo: string }>;
}> {
  // If specific code requested
  if (params.codigo) {
    const found = CODIGOS_SERVICO_SUBSET.filter((c) => c.codigo === params.codigo);
    if (found.length > 0) {
      return { total: found.length, codigos: found };
    }

    // Try API for full list
    try {
      const response = await client.getJson(`/parametrizacao/codigosServico?codigo=${params.codigo}`);
      const data = JSON.parse(response.body);
      const codigos = Array.isArray(data) ? data : data.codigos || [];
      return { total: codigos.length, codigos };
    } catch {
      return { total: 0, codigos: [] };
    }
  }

  // Text search
  if (params.busca) {
    const needle = params.busca.toLowerCase();
    const found = CODIGOS_SERVICO_SUBSET.filter(
      (c) => c.descricao.toLowerCase().includes(needle) || c.grupo.toLowerCase().includes(needle) || c.codigo.includes(needle),
    );
    return { total: found.length, codigos: found };
  }

  return { total: CODIGOS_SERVICO_SUBSET.length, codigos: CODIGOS_SERVICO_SUBSET };
}

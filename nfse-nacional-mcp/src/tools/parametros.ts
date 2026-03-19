/**
 * Tools de parâmetros: nfse_parametros_municipio, nfse_parametros_contribuinte,
 * nfse_cnc_consultar, nfse_codigos_servico
 *
 * Nota: O ADN de Recepção (adn.nfse.gov.br) expõe apenas POST /DFe e GET /danfse/v1.
 * APIs de parametrização, CNC e contribuintes não estão disponíveis neste endpoint.
 * Estas funções usam dados locais ou retornam informação sobre a indisponibilidade.
 */

import type { AdnHttpClient } from "../auth/http-client.js";
import { NfseValidationError } from "../errors/nfse-errors.js";

export async function nfseParametrosMunicipio(
  _client: AdnHttpClient,
  params: {
    codigoMunicipio: string;
    cpfCnpj?: string;
  },
): Promise<{
  codigoMunicipio: string;
  mensagem: string;
  sugestao: string;
}> {
  if (!params.codigoMunicipio || params.codigoMunicipio.length !== 7) {
    throw new NfseValidationError([{
      field: "codigoMunicipio",
      message: "Código IBGE deve ter 7 dígitos",
    }]);
  }

  return {
    codigoMunicipio: params.codigoMunicipio,
    mensagem: "A API de parametrização municipal não está disponível no ADN de Recepção. " +
      "Parâmetros municipais devem ser consultados diretamente no portal da prefeitura ou via SEFIN municipal.",
    sugestao: "Para emitir NFS-e, informe os dados fiscais do município (alíquota ISS, código de serviço) " +
      "conforme a legislação municipal vigente.",
  };
}

export async function nfseParametrosContribuinte(
  _client: AdnHttpClient,
  params: {
    codigoMunicipio: string;
    cpfCnpj: string;
  },
): Promise<{
  cpfCnpj: string;
  codigoMunicipio: string;
  mensagem: string;
}> {
  if (!params.cpfCnpj) {
    throw new NfseValidationError([{ field: "cpfCnpj", message: "CPF/CNPJ é obrigatório" }]);
  }
  if (!params.codigoMunicipio || params.codigoMunicipio.length !== 7) {
    throw new NfseValidationError([{ field: "codigoMunicipio", message: "Código IBGE deve ter 7 dígitos" }]);
  }

  return {
    cpfCnpj: params.cpfCnpj,
    codigoMunicipio: params.codigoMunicipio,
    mensagem: "A API de parâmetros do contribuinte não está disponível no ADN de Recepção. " +
      "Consulte o cadastro municipal do contribuinte diretamente na prefeitura.",
  };
}

export async function nfseCncConsultar(
  _client: AdnHttpClient,
  params: {
    cpfCnpj: string;
    codigoMunicipio?: string;
  },
): Promise<{
  cpfCnpj: string;
  mensagem: string;
}> {
  if (!params.cpfCnpj) {
    throw new NfseValidationError([{ field: "cpfCnpj", message: "CPF/CNPJ é obrigatório" }]);
  }

  return {
    cpfCnpj: params.cpfCnpj,
    mensagem: "O Cadastro Nacional de Contribuintes (CNC) não está disponível no ADN de Recepção. " +
      "Consulte o CNC pelo portal https://www.gov.br/nfse.",
  };
}

/**
 * Códigos de tributação nacional da LC 116/2003
 * Dados locais — não depende de API.
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
  _client: AdnHttpClient,
  params: {
    busca?: string;
    codigo?: string;
  },
): Promise<{
  total: number;
  codigos: Array<{ codigo: string; descricao: string; grupo: string }>;
}> {
  if (params.codigo) {
    const found = CODIGOS_SERVICO_SUBSET.filter((c) => c.codigo === params.codigo);
    return { total: found.length, codigos: found };
  }

  if (params.busca) {
    const needle = params.busca.toLowerCase();
    const found = CODIGOS_SERVICO_SUBSET.filter(
      (c) => c.descricao.toLowerCase().includes(needle) || c.grupo.toLowerCase().includes(needle) || c.codigo.includes(needle),
    );
    return { total: found.length, codigos: found };
  }

  return { total: CODIGOS_SERVICO_SUBSET.length, codigos: CODIGOS_SERVICO_SUBSET };
}

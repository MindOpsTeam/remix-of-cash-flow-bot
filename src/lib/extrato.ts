/**
 * Leitor de extrato colado.
 *
 * O dono de PME não sabe exportar OFX, mas sabe selecionar e copiar. Um campo
 * de texto mais este heurístico cobre extrato de app de banco, print de
 * planilha, PDF colado e lista de WhatsApp, sem pedir formato nenhum e sem
 * suporte respondendo "qual arquivo eu baixo?".
 *
 * É código puro de propósito: roda no navegador, custa zero token e é testável.
 * A IA entra depois, só para classificar o que sobrou sem regra.
 */

export interface LinhaExtrato {
  data: string;
  descricao: string;
  valor: number;
  tipo: "revenue" | "expense";
  /** Linha original, para o usuário conferir o que foi lido. */
  original: string;
}

export interface LeituraExtrato {
  linhas: LinhaExtrato[];
  ignoradas: string[];
  totalEntradas: number;
  totalSaidas: number;
}

const MESES: Record<string, number> = {
  jan: 1, fev: 2, mar: 3, abr: 4, mai: 5, jun: 6,
  jul: 7, ago: 8, set: 9, out: 10, nov: 11, dez: 12,
};

/** Palavras que aparecem em cabeçalho e rodapé de extrato, nunca em lançamento. */
const RUIDO = [
  "saldo", "extrato", "período", "periodo", "agência", "agencia", "conta corrente",
  "total", "subtotal", "data lançamento", "data lancamento", "histórico", "historico",
  "documento", "banco", "cnpj", "cpf:", "página", "pagina",
];

function normalizarAno(ano: number): number {
  if (ano > 1900) return ano;
  return ano < 70 ? 2000 + ano : 1900 + ano;
}

/** Aceita 05/07, 05/07/26, 05/07/2026, 2026-07-05 e "05 jul". */
function extrairData(texto: string, anoPadrao: number): { iso: string; resto: string } | null {
  let m = texto.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (m) {
    return { iso: `${m[1]}-${m[2]}-${m[3]}`, resto: texto.replace(m[0], " ") };
  }
  m = texto.match(/(\d{1,2})[/.-](\d{1,2})(?:[/.-](\d{2,4}))?/);
  if (m) {
    const dia = Number(m[1]);
    const mes = Number(m[2]);
    if (dia >= 1 && dia <= 31 && mes >= 1 && mes <= 12) {
      const ano = m[3] ? normalizarAno(Number(m[3])) : anoPadrao;
      return {
        iso: `${ano}-${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`,
        resto: texto.replace(m[0], " "),
      };
    }
  }
  m = texto.match(/(\d{1,2})\s*(?:de\s*)?([a-zç]{3})[a-zç]*/i);
  if (m && MESES[m[2].toLowerCase()]) {
    const dia = Number(m[1]);
    const mes = MESES[m[2].toLowerCase()];
    if (dia >= 1 && dia <= 31) {
      return {
        iso: `${anoPadrao}-${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`,
        resto: texto.replace(m[0], " "),
      };
    }
  }
  return null;
}

/**
 * O valor é sempre o ÚLTIMO número monetário da linha. Extrato costuma trazer
 * saldo acumulado depois do valor, mas quando isso acontece há dois números e
 * pegamos o primeiro deles como movimento. Regra: se houver dois candidatos na
 * cauda, o movimento é o primeiro e o saldo é o segundo.
 */
function extrairValor(texto: string): { valor: number; negativo: boolean; resto: string } | null {
  const padrao = /(-|\(|−)?\s*R?\$?\s*(\d{1,3}(?:\.\d{3})*,\d{2}|\d+,\d{2}|\d{1,3}(?:,\d{3})*\.\d{2}|\d+\.\d{2})\s*(\)|-|C|D)?/gi;
  const achados = [...texto.matchAll(padrao)];
  if (!achados.length) return null;

  const escolhido = achados.length >= 2 ? achados[achados.length - 2] : achados[achados.length - 1];
  const bruto = escolhido[2];
  const temVirgulaDecimal = /,\d{2}$/.test(bruto);
  const numero = temVirgulaDecimal
    ? Number(bruto.replace(/\./g, "").replace(",", "."))
    : Number(bruto.replace(/,/g, ""));
  if (!Number.isFinite(numero) || numero === 0) return null;

  const antes = escolhido[1];
  const depois = escolhido[3];
  const negativo =
    antes === "-" || antes === "(" || antes === "−" || depois === ")" || depois === "-" ||
    (depois ?? "").toUpperCase() === "D";

  return { valor: Math.abs(numero), negativo, resto: texto.replace(escolhido[0], " ") };
}

/** Verbos de extrato que revelam a direção quando não há sinal. */
function direcaoPelaDescricao(descricao: string): "revenue" | "expense" | null {
  const d = descricao.toLowerCase();
  if (/\b(recebid|recebiment|credito|crédito|deposit|entrada|liquidac|liquidaç|estorno)/.test(d)) return "revenue";
  if (/\b(enviad|pagament|pago|debito|débito|saque|compra|tarifa|taxa|saida|saída|transferencia enviada)/.test(d)) return "expense";
  return null;
}

export function lerExtrato(texto: string, anoPadrao = new Date().getFullYear()): LeituraExtrato {
  const linhas: LinhaExtrato[] = [];
  const ignoradas: string[] = [];

  for (const bruta of (texto ?? "").split(/\r?\n/)) {
    const linha = bruta.trim();
    if (linha.length < 6) continue;

    const minuscula = linha.toLowerCase();
    if (RUIDO.some((r) => minuscula.startsWith(r))) {
      ignoradas.push(linha);
      continue;
    }

    const data = extrairData(linha, anoPadrao);
    if (!data) { ignoradas.push(linha); continue; }

    const valor = extrairValor(data.resto);
    if (!valor) { ignoradas.push(linha); continue; }

    const descricao = valor.resto
      .replace(/[;|\t]+/g, " ")
      .replace(/\s{2,}/g, " ")
      .replace(/^[\s\-–—:]+|[\s\-–—:]+$/g, "")
      .trim();

    if (descricao.length < 2) { ignoradas.push(linha); continue; }

    const tipo = valor.negativo
      ? "expense"
      : direcaoPelaDescricao(descricao) ?? "revenue";

    linhas.push({ data: data.iso, descricao, valor: valor.valor, tipo, original: linha });
  }

  return {
    linhas,
    ignoradas,
    totalEntradas: linhas.filter((l) => l.tipo === "revenue").reduce((s, l) => s + l.valor, 0),
    totalSaidas: linhas.filter((l) => l.tipo === "expense").reduce((s, l) => s + l.valor, 0),
  };
}

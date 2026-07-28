/**
 * Lançamento em linguagem natural.
 *
 * "paguei 350 de energia ontem" vira um lançamento.
 *
 * O número que explica o produto: a mediana dos usuários NUNCA lançou nada, e o
 * sistema criou 2.877 linhas de configuração para sustentar 34 lançamentos
 * reais. Colar extrato resolve o volume; isto resolve o avulso, o gasto que o
 * dono lembra no semáforo e que não vai virar formulário de sete campos.
 *
 * Regra da casa aplicada até o fim: VALOR e DATA saem daqui, de código puro,
 * porque são número e o modelo nunca é fonte de número. A IA entra depois, só
 * para dizer em qual conta contábil aquilo cai.
 */

export interface LancamentoLido {
  valor: number;
  data: string;
  tipo: "revenue" | "expense";
  descricao: string;
  /** O que o texto não deixou claro e a tela precisa confirmar. */
  incerto: Array<"valor" | "data" | "tipo">;
}

const VERBOS_SAIDA = /\b(paguei|pago|gastei|comprei|saiu|debitei|transferi|desembolsei)\b/i;
const VERBOS_ENTRADA = /\b(recebi|recebido|entrou|caiu|faturei|vendi|creditei)\b/i;

const MESES: Record<string, number> = {
  jan: 1, fev: 2, mar: 3, abr: 4, mai: 5, jun: 6,
  jul: 7, ago: 8, set: 9, out: 10, nov: 11, dez: 12,
};

/** Palavras que sobram depois de extrair valor, data e verbo. */
const RUIDO = /\b(de|do|da|dos|das|em|no|na|nos|nas|para|pra|pro|com|por|r\$|reais?|hoje|ontem|anteontem|foi|um|uma|o|a|os|as)\b/gi;

function iso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/**
 * O valor é o primeiro número monetário do texto.
 *
 * Aceita "350", "350,90", "1.240,00", "R$ 89,90" e "1200". Não aceita número
 * colado em palavra ("conta 3 vias") porque exige limite de palavra, e não
 * aceita o que veio junto de barra de data.
 */
function extrairValor(texto: string): { valor: number; resto: string } | null {
  const padrao = /(?:r\$\s*)?\b(\d{1,3}(?:\.\d{3})+,\d{2}|\d+,\d{2}|\d{1,3}(?:\.\d{3})+|\d+)\b(?!\s*[/-]\s*\d)/i;
  const m = texto.match(padrao);
  if (!m) return null;

  const bruto = m[1];
  const temDecimal = /,\d{2}$/.test(bruto);
  const numero = temDecimal
    ? Number(bruto.replace(/\./g, "").replace(",", "."))
    : Number(bruto.replace(/\./g, ""));

  if (!Number.isFinite(numero) || numero <= 0) return null;
  return { valor: numero, resto: texto.replace(m[0], " ") };
}

/** Aceita hoje, ontem, anteontem, "dia 5", 05/07, 05/07/2026 e "5 de julho". */
function extrairData(texto: string, hoje: Date): { data: string; resto: string; explicita: boolean } {
  const t = texto.toLowerCase();

  const relativo = (dias: number) => {
    const d = new Date(hoje);
    d.setDate(d.getDate() - dias);
    return d;
  };

  if (/\banteontem\b/.test(t)) {
    return { data: iso(relativo(2)), resto: texto.replace(/\banteontem\b/i, " "), explicita: true };
  }
  if (/\bontem\b/.test(t)) {
    return { data: iso(relativo(1)), resto: texto.replace(/\bontem\b/i, " "), explicita: true };
  }
  if (/\bhoje\b/.test(t)) {
    return { data: iso(hoje), resto: texto.replace(/\bhoje\b/i, " "), explicita: true };
  }

  const completa = texto.match(/\b(\d{1,2})[/](\d{1,2})(?:[/](\d{2,4}))?\b/);
  if (completa) {
    const dia = Number(completa[1]);
    const mes = Number(completa[2]);
    if (dia >= 1 && dia <= 31 && mes >= 1 && mes <= 12) {
      let ano = completa[3] ? Number(completa[3]) : hoje.getFullYear();
      if (ano < 100) ano += 2000;
      return {
        data: `${ano}-${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`,
        resto: texto.replace(completa[0], " "),
        explicita: true,
      };
    }
  }

  const porExtenso = texto.match(/\b(\d{1,2})\s*de\s*([a-zç]{3})[a-zç]*/i);
  if (porExtenso && MESES[porExtenso[2].toLowerCase()]) {
    const dia = Number(porExtenso[1]);
    const mes = MESES[porExtenso[2].toLowerCase()];
    if (dia >= 1 && dia <= 31) {
      return {
        data: `${hoje.getFullYear()}-${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`,
        resto: texto.replace(porExtenso[0], " "),
        explicita: true,
      };
    }
  }

  const diaSolto = texto.match(/\bdia\s+(\d{1,2})\b/i);
  if (diaSolto) {
    const dia = Number(diaSolto[1]);
    if (dia >= 1 && dia <= 31) {
      return {
        data: `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}-${String(dia).padStart(2, "0")}`,
        resto: texto.replace(diaSolto[0], " "),
        explicita: true,
      };
    }
  }

  // Sem data no texto, hoje é o palpite certo, mas fica marcado como incerto
  // para a tela mostrar em vez de esconder.
  return { data: iso(hoje), resto: texto, explicita: false };
}

export function lerLancamento(texto: string, hoje = new Date()): LancamentoLido | null {
  const original = (texto ?? "").trim();
  if (original.length < 3) return null;

  // Data primeiro: "05/07" tem números que o extrator de valor pegaria.
  const d = extrairData(original, hoje);
  const v = extrairValor(d.resto);
  if (!v) return null;

  const incerto: LancamentoLido["incerto"] = [];
  if (!d.explicita) incerto.push("data");

  let tipo: LancamentoLido["tipo"];
  if (VERBOS_ENTRADA.test(original)) {
    tipo = "revenue";
  } else if (VERBOS_SAIDA.test(original)) {
    tipo = "expense";
  } else {
    // Quem digita um valor solto quase sempre está registrando um gasto, mas o
    // palpite fica declarado em vez de silencioso.
    tipo = "expense";
    incerto.push("tipo");
  }

  const descricao = v.resto
    .replace(VERBOS_SAIDA, " ")
    .replace(VERBOS_ENTRADA, " ")
    .replace(RUIDO, " ")
    .replace(/[^\p{L}\p{N}\s&.-]/gu, " ")
    .replace(/\s{2,}/g, " ")
    .trim();

  return {
    valor: v.valor,
    data: d.data,
    tipo,
    // Descrição vazia acontece em "paguei 350 ontem". O original serve melhor
    // que string vazia: o usuário reconhece o que digitou.
    descricao: descricao.length >= 2 ? descricao : original,
    incerto,
  };
}

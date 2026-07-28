/**
 * Regras dos agentes.
 *
 * Antes cada agente carregava os próprios números como constante no código:
 * DIAS_ANTECEDENCIA = 3, FATOR_ANOMALIA = 3, VALOR_MINIMO = 500. Isso é palpite
 * nosso valendo igual para 131 empresas. Uma clínica cobra no dia; uma indústria
 * dá quinze dias de tolerância. "Gasto fora da curva" para um é R$ 500, para
 * outro é R$ 50 mil.
 *
 * Aqui ficam os PADRÕES e a fusão com o que a empresa configurou. Nenhum agente
 * volta a decidir número sozinho.
 */

export type NomeAgente = "collections" | "anomalies" | "close" | "alerts";

export interface RegraCobranca {
  /** Quantos dias ANTES do vencimento começar a lembrar. */
  dias_antes: number;
  /** Em quais dias DEPOIS do vencimento insistir. Vazio = não insiste. */
  dias_depois: number[];
  /** Abaixo disso não vale o incômodo de cobrar. */
  valor_minimo: number;
  /** Como o texto deve soar. Vai para o modelo, não para cálculo. */
  tom: "cordial" | "direto" | "formal";
  /** Assinatura no fim da mensagem. Vazio usa o nome da empresa. */
  assinatura: string;
}

export interface RegraAnomalia {
  /** Quantas vezes acima da média da conta para virar alerta. */
  fator: number;
  /** Piso absoluto: abaixo disso não alerta, por maior que seja o múltiplo. */
  valor_minimo: number;
  /** Janela de lançamentos novos a examinar, em dias. */
  janela_dias: number;
  /** Histórico usado como base de comparação, em dias. */
  baseline_dias: number;
}

export const PADRAO_COBRANCA: RegraCobranca = {
  dias_antes: 3,
  dias_depois: [1, 7, 15],
  valor_minimo: 0,
  tom: "cordial",
  assinatura: "",
};

export const PADRAO_ANOMALIA: RegraAnomalia = {
  fator: 3,
  valor_minimo: 500,
  janela_dias: 7,
  baseline_dias: 90,
};

export interface LinhaRegra {
  agent: string;
  ativo: boolean;
  config: Record<string, unknown> | null;
}

/**
 * A busca entra como função, e não como o cliente Supabase inteiro.
 *
 * Descrever o cliente por estrutura (`from(...).select(...).eq(...)`) faz o
 * TypeScript tentar casar com os genéricos profundos do SupabaseClient e
 * estourar em TS2589, "type instantiation is excessively deep". Receber a
 * consulta já montada evita isso e ainda deixa explícito, em cada agente, o que
 * está sendo lido.
 */
export type BuscarRegras = () => PromiseLike<{ data: LinhaRegra[] | null }>;

function numero(valor: unknown, padrao: number, min: number, max: number): number {
  const n = Number(valor);
  if (!Number.isFinite(n)) return padrao;
  return Math.min(max, Math.max(min, n));
}

/**
 * Lê a configuração da empresa e funde com o padrão.
 *
 * Cada campo é validado contra um intervalo. Config vem de jsonb, ou seja, de
 * fora: aceitar `fator: 0` faria o agente de anomalia alertar em TODO
 * lançamento, e `dias_depois` gigante faria ele cobrar por anos. Faixa fechada
 * é mais barato do que descobrir isso com o cliente reclamando.
 */
export async function lerRegras(buscar: BuscarRegras): Promise<{
  ativo: Record<NomeAgente, boolean>;
  cobranca: RegraCobranca;
  anomalia: RegraAnomalia;
}> {
  let linhas: LinhaRegra[] = [];
  try {
    const { data } = await buscar();
    linhas = data ?? [];
  } catch {
    // Sem configuração o agente roda no padrão. Nunca deixar de rodar por causa
    // da leitura da própria configuração.
  }

  const por = new Map(linhas.map((l) => [l.agent, l]));
  const ativoDe = (nome: NomeAgente) => por.get(nome)?.ativo ?? true;

  const c = (por.get("collections")?.config ?? {}) as Record<string, unknown>;
  const a = (por.get("anomalies")?.config ?? {}) as Record<string, unknown>;

  const diasDepois = Array.isArray(c.dias_depois)
    ? [...new Set((c.dias_depois as unknown[]).map((d) => Math.round(numero(d, 0, 1, 365))))]
        .filter((d) => d > 0)
        .sort((x, y) => x - y)
        .slice(0, 6)
    : PADRAO_COBRANCA.dias_depois;

  const tom = ["cordial", "direto", "formal"].includes(String(c.tom))
    ? (String(c.tom) as RegraCobranca["tom"])
    : PADRAO_COBRANCA.tom;

  return {
    ativo: {
      collections: ativoDe("collections"),
      anomalies: ativoDe("anomalies"),
      close: ativoDe("close"),
      alerts: ativoDe("alerts"),
    },
    cobranca: {
      dias_antes: numero(c.dias_antes, PADRAO_COBRANCA.dias_antes, 0, 60),
      dias_depois: diasDepois,
      valor_minimo: numero(c.valor_minimo, PADRAO_COBRANCA.valor_minimo, 0, 1_000_000),
      tom,
      assinatura: typeof c.assinatura === "string" ? c.assinatura.slice(0, 120) : PADRAO_COBRANCA.assinatura,
    },
    anomalia: {
      fator: numero(a.fator, PADRAO_ANOMALIA.fator, 1.2, 100),
      valor_minimo: numero(a.valor_minimo, PADRAO_ANOMALIA.valor_minimo, 0, 10_000_000),
      janela_dias: numero(a.janela_dias, PADRAO_ANOMALIA.janela_dias, 1, 90),
      baseline_dias: numero(a.baseline_dias, PADRAO_ANOMALIA.baseline_dias, 30, 730),
    },
  };
}

/**
 * Decide se HOJE é dia de falar sobre este vencimento, e com que urgência.
 *
 * Determinístico de propósito: quem escolhe o dia é a régua da empresa, não o
 * modelo. O modelo só escreve a frase depois que esta função disse que é hora.
 * Devolve null quando não é dia de falar.
 */
export function momentoDaCobranca(
  diasAteVencer: number,
  regra: RegraCobranca,
): { estagio: "lembrete" | "vencendo" | "atraso"; diasAtraso: number } | null {
  if (diasAteVencer > 0) {
    return diasAteVencer === regra.dias_antes ? { estagio: "lembrete", diasAtraso: 0 } : null;
  }
  if (diasAteVencer === 0) return { estagio: "vencendo", diasAtraso: 0 };

  const atraso = -diasAteVencer;
  return regra.dias_depois.includes(atraso) ? { estagio: "atraso", diasAtraso: atraso } : null;
}

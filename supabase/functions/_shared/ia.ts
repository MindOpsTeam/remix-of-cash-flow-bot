/**
 * Camada de IA da casa.
 *
 * Três regras que valem para TODA função que chama modelo:
 *
 * 1. NÚMERO NÃO PASSA POR MODELO. O modelo lê um número que outra coisa
 *    calculou e escreve a frase em volta. Ele nunca é a fonte do valor.
 * 2. DETERMINÍSTICO ANTES DE MODELO. Se existe regra, tabela ou conta que
 *    responde, o modelo não é chamado. Barato, estável e auditável.
 * 3. TODA CHAMADA É MEDIDA. Sem `ai_usage` não se sabe qual cliente queima a
 *    margem, e sem saber não dá para degradar em vez de derrubar.
 */

const GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";

/** Preço por milhão de tokens, em centavos de real. Aproximação para controle. */
const PRECO_CENTAVOS: Record<string, { entrada: number; saida: number }> = {
  "google/gemini-2.5-flash-lite": { entrada: 4, saida: 15 },
  "google/gemini-2.5-flash": { entrada: 18, saida: 65 },
  "google/gemini-2.5-pro": { entrada: 130, saida: 500 },
};

export interface RespostaModelo<T> {
  dados: T | null;
  erro: string | null;
  modelo: string;
  promptTokens: number;
  completionTokens: number;
  custoCentavos: number;
}

interface OpcoesModelo {
  modelo?: string;
  /** JSON Schema. Com ele o gateway devolve JSON válido e some a regex frágil. */
  schema?: Record<string, unknown>;
  temperatura?: number;
  maxTokens?: number;
}

/**
 * Chama o modelo pedindo saída ESTRUTURADA. Nada de extrair JSON com expressão
 * regular: a regex antiga quebrava em qualquer objeto aninhado e transformava
 * falha de parse em "não sei", escondendo o erro.
 */
export async function chamarModelo<T>(
  apiKey: string,
  mensagens: Array<{ role: string; content: string }>,
  opcoes: OpcoesModelo = {},
): Promise<RespostaModelo<T>> {
  const modelo = opcoes.modelo ?? "google/gemini-2.5-flash-lite";
  const vazio = { modelo, promptTokens: 0, completionTokens: 0, custoCentavos: 0 };

  try {
    const corpo: Record<string, unknown> = {
      model: modelo,
      messages: mensagens,
      temperature: opcoes.temperatura ?? 0,
      max_tokens: opcoes.maxTokens ?? 800,
    };
    if (opcoes.schema) {
      corpo.response_format = {
        type: "json_schema",
        json_schema: { name: "resposta", strict: true, schema: opcoes.schema },
      };
    }

    const res = await fetch(GATEWAY, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify(corpo),
    });

    if (!res.ok) {
      const detalhe = await res.text();
      const amigavel =
        res.status === 429
          ? "A IA está sobrecarregada agora. Tente de novo em instantes."
          : res.status === 402
            ? "Créditos de IA esgotados nesta conta."
            : `IA indisponível (${res.status})`;
      return { ...vazio, dados: null, erro: `${amigavel} ${detalhe.slice(0, 200)}` };
    }

    const json = await res.json();
    const conteudo = json?.choices?.[0]?.message?.content ?? "";
    const uso = json?.usage ?? {};
    const promptTokens = Number(uso.prompt_tokens ?? 0);
    const completionTokens = Number(uso.completion_tokens ?? 0);
    const preco = PRECO_CENTAVOS[modelo] ?? PRECO_CENTAVOS["google/gemini-2.5-flash"];
    const custoCentavos =
      (promptTokens / 1_000_000) * preco.entrada + (completionTokens / 1_000_000) * preco.saida;

    let dados: T | null = null;
    try {
      dados = JSON.parse(conteudo) as T;
    } catch {
      // Sem schema o modelo às vezes embrulha em cerca de código.
      const limpo = conteudo.replace(/^```(?:json)?\s*|\s*```$/g, "").trim();
      try { dados = JSON.parse(limpo) as T; } catch { dados = null; }
    }

    return {
      dados,
      erro: dados === null ? "A IA respondeu num formato que não consegui ler." : null,
      modelo, promptTokens, completionTokens, custoCentavos,
    };
  } catch (e) {
    return { ...vazio, dados: null, erro: (e as Error).message };
  }
}

/** Registra o consumo. Nunca derruba a operação principal se falhar. */
export async function registrarUso(
  supabase: { from: (t: string) => { insert: (v: unknown) => Promise<unknown> } },
  companyId: string | null,
  funcao: string,
  r: { modelo: string; promptTokens: number; completionTokens: number; custoCentavos: number; erro: string | null },
): Promise<void> {
  try {
    await supabase.from("ai_usage").insert({
      company_id: companyId,
      funcao,
      modelo: r.modelo,
      prompt_tokens: r.promptTokens,
      completion_tokens: r.completionTokens,
      custo_centavos: Number(r.custoCentavos.toFixed(4)),
      sucesso: r.erro === null,
    });
  } catch (_) {
    // medir não pode quebrar o que está sendo medido
  }
}

/**
 * Normaliza descrição de lançamento para casar regra: sem acento, sem número,
 * sem ruído de extrato. "PIX ENVIADO 12/07 POSTO SHELL 4411" vira "pix enviado
 * posto shell", que é o que se repete todo mês.
 */
export function normalizarDescricao(texto: string): string {
  return (texto ?? "")
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\d+/g, " ")
    .replace(/[^a-z\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .filter((p) => p.length > 2)
    .slice(0, 6)
    .join(" ");
}

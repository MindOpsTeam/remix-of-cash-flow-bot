/**
 * A mensagem REAL de uma edge function.
 *
 * O DEFEITO QUE ISTO RESOLVE
 * O supabase-js converte qualquer resposta não-2xx de uma edge function num
 * `FunctionsHttpError` cuja mensagem é sempre a mesma frase inútil:
 * "Edge Function returned a non-2xx status code". O corpo, que traz a explicação
 * de verdade ("Stripe não configurado: informe a chave secreta em Configurações",
 * "Esta empresa tem mais de um canal Stripe", "EVOLUTION_NOT_CONFIGURED"), fica
 * escondido dentro de `error.context`, que é a Response original.
 *
 * O resultado é o pior tipo de erro: o sistema sabe exatamente o que houve e
 * mostra ao usuário uma frase que não diz nada e não sugere nada. Ele abre um
 * chamado. Numa solução entregue por remix, sem suporte, ele desiste.
 */

/** Chaves em que as nossas edges costumam colocar a explicação. */
const CHAVES_DE_MENSAGEM = ["detalhe", "error", "message", "erro"] as const;

/** Códigos que as edges devolvem crus; aqui viram frase de gente. */
const TRADUCAO: Record<string, string> = {
  EVOLUTION_NOT_CONFIGURED:
    "Este canal não tem servidor e chave da Evolution salvos. Preencha a URL e a API key e salve antes de testar.",
  READ_ONLY_ROLE:
    "Seu perfil nesta empresa é somente leitura. Peça a um administrador para liberar o acesso de edição.",
  REMIX_NECESSARIO:
    "Este é o projeto de demonstração, aberto só para consulta. Faça o remix para ter o seu próprio ambiente.",
};

interface ComContexto {
  context?: { json?: () => Promise<unknown>; text?: () => Promise<string>; status?: number };
  message?: string;
  name?: string;
}

function extrairDoCorpo(corpo: unknown): string | null {
  if (!corpo) return null;
  if (typeof corpo === "string") return corpo.trim() || null;
  if (typeof corpo !== "object") return null;

  const obj = corpo as Record<string, unknown>;
  for (const chave of CHAVES_DE_MENSAGEM) {
    const v = obj[chave];
    if (typeof v === "string" && v.trim()) return v.trim();
    // Alguns provedores devolvem { error: { message: "..." } }
    if (v && typeof v === "object") {
      const aninhado = (v as Record<string, unknown>).message;
      if (typeof aninhado === "string" && aninhado.trim()) return aninhado.trim();
    }
  }
  return null;
}

/**
 * Devolve a mensagem que o usuário deve ler.
 *
 * É async porque ler o corpo da Response é async, e vale a pena: a alternativa
 * é continuar mostrando a frase genérica. Nunca lança: uma falha aqui não pode
 * substituir o erro original por um erro sobre o erro.
 */
export async function mensagemDaEdge(erro: unknown, padrao = "A chamada falhou."): Promise<string> {
  const e = erro as ComContexto | null;
  if (!e) return padrao;

  const generica = /non-2xx status code|Failed to send a request/i;

  try {
    const ctx = e.context;
    if (ctx) {
      let corpo: unknown = null;
      if (typeof ctx.json === "function") {
        corpo = await ctx.json().catch(() => null);
      }
      if (corpo === null && typeof ctx.text === "function") {
        corpo = await ctx.text().catch(() => null);
      }
      const doCorpo = extrairDoCorpo(corpo);
      if (doCorpo) return TRADUCAO[doCorpo] ?? doCorpo;
    }
  } catch {
    // Ignora de propósito: cai na mensagem original abaixo.
  }

  const original = typeof e.message === "string" ? e.message.trim() : "";
  if (original && !generica.test(original)) return TRADUCAO[original] ?? original;

  // Sem corpo legível e com mensagem genérica, ao menos dizemos o que fazer.
  return padrao;
}

/**
 * Versão para quem já tem o corpo em mãos (resposta 200 que traz `error` dentro).
 * Existe porque várias das nossas edges respondem 200 com `{ error: "..." }`, e
 * tratar isso como sucesso é como um problema vira silêncio.
 */
export function mensagemDoCorpo(corpo: unknown): string | null {
  const m = extrairDoCorpo(corpo);
  return m ? (TRADUCAO[m] ?? m) : null;
}

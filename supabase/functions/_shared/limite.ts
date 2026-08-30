/**
 * Teto de requisição para os endpoints que não exigem sessão.
 *
 * O contador mora no Postgres (`consumir_limite`), não em memória: cada
 * invocação de uma edge function pode cair num isolate novo, então um contador
 * de processo zeraria sozinho — e daria a impressão de existir um limite onde
 * não existe nenhum.
 *
 * Uso:
 *   const teto = await checarLimite(supabase, `public-api:${keyId}`, 120, 60);
 *   if (teto.excedeu) return teto.resposta(corsHeaders);
 */

// deno-lint-ignore no-explicit-any
type SupabaseClient = any;

export interface ResultadoLimite {
  excedeu: boolean;
  contador: number;
  teto: number;
  /** Segundos até a janela virar. Vira o header Retry-After. */
  reiniciaEm: number;
  resposta: (headers: Record<string, string>) => Response;
}

/**
 * Identidade do chamador para efeito de limite.
 *
 * A ordem importa: o header que o Supabase põe (`x-forwarded-for`) é o que
 * temos de mais próximo do cliente. Sem ele, todos caem num balde só — o que é
 * pior para quem usa direito, mas nunca deixa de contar.
 */
export function origemDaChamada(req: Request): string {
  const encaminhado = req.headers.get("x-forwarded-for");
  if (encaminhado) return encaminhado.split(",")[0].trim();
  return req.headers.get("cf-connecting-ip") ?? "sem-origem";
}

const RESPOSTA_PADRAO = {
  success: false,
  data: null,
  error: "Requisições demais. Tente de novo daqui a pouco.",
};

/**
 * Consome uma unidade do balde e diz se a chamada segue.
 *
 * Falha ABERTO de propósito: se o banco não responder, a alternativa seria
 * derrubar um webhook legítimo de banco ou de emissor por causa de uma
 * indisponibilidade nossa. O limite existe contra abuso, não contra o parceiro.
 * A falha vai para o log com o balde, então some do radar não fica.
 */
export async function checarLimite(
  supabase: SupabaseClient,
  bucket: string,
  teto: number,
  janelaSegundos: number,
): Promise<ResultadoLimite> {
  const liberado = (contador: number, reiniciaEm: number): ResultadoLimite => ({
    excedeu: false,
    contador,
    teto,
    reiniciaEm,
    resposta: () => new Response(null, { status: 204 }),
  });

  try {
    const { data, error } = await supabase.rpc("consumir_limite", {
      p_bucket: bucket,
      p_teto: teto,
      p_janela_segundos: janelaSegundos,
    });

    if (error || !data) {
      console.error("[limite] consumir_limite falhou:", bucket, error?.message);
      return liberado(0, janelaSegundos);
    }

    const reiniciaEm = Math.max(
      1,
      Math.ceil((new Date(data.reinicia_em).getTime() - Date.now()) / 1000),
    );

    if (data.permitido) return liberado(data.contador, reiniciaEm);

    console.warn(`[limite] teto estourado em ${bucket}: ${data.contador}/${teto}`);

    return {
      excedeu: true,
      contador: data.contador,
      teto,
      reiniciaEm,
      resposta: (headers: Record<string, string>) =>
        new Response(JSON.stringify(RESPOSTA_PADRAO), {
          status: 429,
          headers: {
            ...headers,
            "Content-Type": "application/json",
            "Retry-After": String(reiniciaEm),
            "X-RateLimit-Limit": String(teto),
            "X-RateLimit-Remaining": "0",
          },
        }),
    };
  } catch (err) {
    console.error("[limite] exceção em", bucket, String(err));
    return liberado(0, janelaSegundos);
  }
}

/**
 * Compara dois segredos sem deixar o tempo de resposta contar quantos
 * caracteres bateram.
 *
 * `a !== b` sai no primeiro byte diferente. Num endpoint que aceita chamada de
 * qualquer lugar, essa diferença de microssegundos é medível em volume e
 * transforma adivinhar um token de 32 bytes em adivinhar 32 vezes um byte.
 */
export function segredosBatem(recebido: string | null, esperado: string | null): boolean {
  if (!recebido || !esperado) return false;

  const a = new TextEncoder().encode(recebido);
  const b = new TextEncoder().encode(esperado);

  // O tamanho vaza de qualquer jeito (está no corpo da requisição); o que não
  // pode vazar é ONDE os bytes divergem.
  if (a.length !== b.length) return false;

  let diferenca = 0;
  for (let i = 0; i < a.length; i++) diferenca |= a[i] ^ b[i];
  return diferenca === 0;
}

/**
 * Lê o corpo com teto de bytes.
 *
 * Sem isto, `req.json()` aceita o que mandarem e a função paga memória e tempo
 * de CPU por um corpo que ela nunca ia usar. Devolve `null` quando estoura.
 */
export async function corpoLimitado(
  req: Request,
  maxBytes = 256 * 1024,
): Promise<{ texto: string } | { erro: string }> {
  const declarado = req.headers.get("content-length");
  if (declarado && Number(declarado) > maxBytes) {
    return { erro: `Corpo acima de ${maxBytes} bytes` };
  }

  const texto = await req.text();
  // O content-length é do cliente: quem quer abusar simplesmente não manda.
  // A conta que vale é a do que chegou.
  if (new TextEncoder().encode(texto).length > maxBytes) {
    return { erro: `Corpo acima de ${maxBytes} bytes` };
  }
  return { texto };
}

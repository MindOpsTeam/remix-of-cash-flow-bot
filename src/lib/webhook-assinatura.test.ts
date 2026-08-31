import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";

/**
 * A assinatura do webhook de saída.
 *
 * ---
 *
 * **Este teste existe porque o erro que ele previne é invisível dos dois
 * lados.** O FinanceAI assina com Web Crypto (Deno); o Gestor de Tráfego
 * verifica com `node:crypto`. Se os dois algoritmos divergirem em qualquer
 * detalhe — codificação da chave, hex contra base64, o que exatamente é
 * assinado —, o destino responde 401 e o ERP registra "falha de entrega". Nada
 * no log de nenhum dos dois diz *por quê*.
 *
 * A implementação do outro lado, conferida no código e não suposta
 * (`src/server/receita/webhook.ts` do Gestor):
 *
 * ```ts
 * const esperado = createHmac("sha256", segredo).update(corpoCru).digest("hex");
 * ```
 *
 * Então: HMAC-SHA256, chave como texto UTF-8, saída em hexadecimal minúsculo,
 * sobre o **corpo cru**. Os testes abaixo travam cada um desses quatro pontos.
 */

/** Cópia exata do que roda em `supabase/functions/webhook-dispatch/index.ts`. */
async function assinarComoNoDeno(corpo: string, segredo: string): Promise<string> {
  const chave = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(segredo),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const assinatura = await crypto.subtle.sign("HMAC", chave, new TextEncoder().encode(corpo));
  return [...new Uint8Array(assinatura)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Cópia exata do que o Gestor de Tráfego usa para conferir. */
function verificarComoNoGestor(corpo: string, segredo: string): string {
  return createHmac("sha256", segredo).update(corpo).digest("hex");
}

const CORPO = JSON.stringify({
  evento: "transaction.confirmed",
  company_id: "11111111-1111-1111-1111-111111111111",
  transaction: { id: "tx-1", amount: 999.99, type: "revenue", status: "confirmed" },
});

describe("assinatura do webhook de saída", () => {
  it("o que o ERP assina é o que o Gestor de Tráfego espera", async () => {
    const nossa = await assinarComoNoDeno(CORPO, "segredo-compartilhado");
    const deles = verificarComoNoGestor(CORPO, "segredo-compartilhado");
    expect(nossa).toBe(deles);
  });

  it("a saída é hexadecimal minúsculo de 64 caracteres", async () => {
    // Base64 seria aceito por alguns verificadores e recusado por outros. O
    // formato precisa ser um só, e é este.
    const a = await assinarComoNoDeno(CORPO, "s");
    expect(a).toMatch(/^[0-9a-f]{64}$/);
  });

  it("segredo diferente produz assinatura diferente", async () => {
    const a = await assinarComoNoDeno(CORPO, "segredo-a");
    const b = await assinarComoNoDeno(CORPO, "segredo-b");
    expect(a).not.toBe(b);
  });

  it("um byte a mais no corpo muda a assinatura inteira", async () => {
    // É o que faz a assinatura valer alguma coisa: alterar o valor da
    // transação no meio do caminho invalida a mensagem.
    const a = await assinarComoNoDeno(CORPO, "s");
    const b = await assinarComoNoDeno(CORPO.replace("999.99", "9999.99"), "s");
    expect(a).not.toBe(b);
  });

  it("acento no corpo não quebra a assinatura", async () => {
    // Descrição de lançamento vem em português. Se um lado codificasse
    // latin-1 e o outro UTF-8, toda entrega com acento falharia — e só as com
    // acento, que é o tipo de bug que demora semanas para ser notado.
    const comAcento = JSON.stringify({ description: "Manutenção do galpão · à vista" });
    expect(await assinarComoNoDeno(comAcento, "s")).toBe(verificarComoNoGestor(comAcento, "s"));
  });

  it("corpo vazio ainda assina, e não lança", async () => {
    expect(await assinarComoNoDeno("", "s")).toBe(verificarComoNoGestor("", "s"));
  });

  it("segredo com acento também bate", async () => {
    const s = "segredo-com-çedilha";
    expect(await assinarComoNoDeno(CORPO, s)).toBe(verificarComoNoGestor(CORPO, s));
  });
});

/**
 * Regras puras da conciliação Stripe — o caso da maquininha, resolvido.
 *
 * O crédito que o gateway manda pro banco (payout) é LÍQUIDO e em LOTE: N cobranças
 * menos as taxas viram UM depósito. É exatamente o formato da maquininha, e é por
 * isso que a régua 1:1 por valor exato da conciliação bancária nunca casa com ele.
 * Aqui a relação N:1 é explícita, porque o Stripe entrega a composição do lote.
 *
 * Doutrina (CFC / NBC TG 1000, e o mesmo critério de _shared/contabil-br.ts):
 *   1. A receita é reconhecida BRUTA no momento da cobrança. Reconhecer pelo
 *      líquido esconde a dedução e distorce a receita bruta do DRE.
 *   2. A taxa do gateway é despesa do próprio período (4.3), não redutor de receita.
 *   3. O payout em si NÃO É RESULTADO: é transferência entre contas da própria
 *      empresa (saldo no gateway → conta bancária). Lançar o payout como receita
 *      duplicaria o faturamento, agora pelo valor líquido.
 *
 * Este arquivo é PURO de propósito: sem Deno, sem esm.sh, sem fetch. Ele roda na
 * edge function, no bundle do browser e no teste unitário com o mesmo código, que
 * é o que impede a régua de divergir entre onde ela decide e onde ela é exibida.
 */

/** Valor bancário casa com o payout quando a diferença cabe no arredondamento. */
export const TOLERANCIA_REAIS = 0.01;

/** Janela de dias em torno da data de chegada do payout para procurar o crédito. */
export const JANELA_PAYOUT_DIAS = 3;

/** Prefixo do external_id da despesa de taxa: um lançamento por payout, idempotente. */
export const PREFIXO_TAXA = "stripe_fee_";

/** Prefixo do external_id do crédito do payout no banco. */
export const PREFIXO_PAYOUT = "stripe_payout_";

/**
 * Uma linha do extrato do gateway (balance transaction). Valores em CENTAVOS,
 * que é como o Stripe trabalha — converter cedo demais introduz erro de ponto
 * flutuante justamente na conta que precisa fechar exata.
 */
export interface ItemDePayout {
  /** id da balance transaction (txn_...) */
  id: string;
  /** charge, refund, adjustment, ... */
  tipo: string;
  /** valor bruto em centavos (negativo em estorno) */
  bruto: number;
  /** taxa do gateway em centavos (sempre >= 0) */
  taxa: number;
  /** bruto - taxa, em centavos */
  liquido: number;
  /** id da cobrança de origem (ch_... / pi_...), quando houver */
  origem?: string | null;
}

export interface ComposicaoDePayout {
  quantidade: number;
  bruto: number;
  taxa: number;
  liquido: number;
}

export function componhePayout(itens: readonly ItemDePayout[]): ComposicaoDePayout {
  return itens.reduce<ComposicaoDePayout>(
    (acc, i) => ({
      quantidade: acc.quantidade + 1,
      bruto: acc.bruto + i.bruto,
      taxa: acc.taxa + i.taxa,
      liquido: acc.liquido + i.liquido,
    }),
    { quantidade: 0, bruto: 0, taxa: 0, liquido: 0 },
  );
}

export interface ConferenciaDePayout {
  fecha: boolean;
  /** informado − somado, em centavos. Positivo = faltou item no lote. */
  diferenca: number;
  composicao: ComposicaoDePayout;
}

/**
 * O lote só pode ser conciliado se a soma dos itens reproduzir EXATAMENTE o valor
 * que o gateway diz ter depositado. Centavos são inteiros, então não existe
 * "quase fecha": diferença diferente de zero significa item faltando (página não
 * lida, estorno posterior) e a conciliação tem que parar em vez de chutar.
 */
export function confereDePayout(
  liquidoInformadoCentavos: number,
  itens: readonly ItemDePayout[],
): ConferenciaDePayout {
  const composicao = componhePayout(itens);
  const diferenca = liquidoInformadoCentavos - composicao.liquido;
  return { fecha: diferenca === 0, diferenca, composicao };
}

/** Centavos do gateway → reais do banco de dados (numeric). */
export function paraReais(centavos: number): number {
  return Math.round(centavos) / 100;
}

/** Reais do banco de dados → centavos do gateway. */
export function paraCentavos(reais: number): number {
  return Math.round(reais * 100);
}

/**
 * Janela de busca do crédito no extrato. A data de chegada informada pelo gateway
 * é uma previsão: feriado e horário de corte empurram o crédito real em um ou dois
 * dias, para frente ou para trás.
 */
export function janelaPayout(dataIso: string, dias: number = JANELA_PAYOUT_DIAS): { de: string; ate: string } {
  const base = new Date(`${dataIso.slice(0, 10)}T00:00:00Z`);
  const desloca = (n: number) => {
    const d = new Date(base);
    d.setUTCDate(d.getUTCDate() + n);
    return d.toISOString().slice(0, 10);
  };
  return { de: desloca(-dias), ate: desloca(dias) };
}

/** O crédito do banco casa com o payout? Comparação em reais, com tolerância de centavo. */
export function creditoCasaComPayout(valorNoBanco: number, liquidoCentavos: number): boolean {
  return Math.abs(valorNoBanco - paraReais(liquidoCentavos)) <= TOLERANCIA_REAIS;
}

export type DestinoDaLinha = "transferencia" | "receita" | "despesa";

/**
 * O crédito do payout no extrato é TRANSFERÊNCIA, nunca receita. A receita já foi
 * reconhecida pelo bruto quando cada cobrança foi paga; classificar o depósito como
 * receita fatura o mesmo dinheiro duas vezes. Mesmo critério do bloqueio de
 * "transferência entre contas próprias" em _shared/contabil-heuristica.ts.
 */
export function destinoDoCreditoDePayout(): DestinoDaLinha {
  return "transferencia";
}

export function descricaoDoPayout(payoutId: string, c: ComposicaoDePayout): string {
  const n = c.quantidade;
  const plural = n === 1 ? "cobrança" : "cobranças";
  return `Repasse Stripe ${payoutId} — ${n} ${plural}, bruto ${paraReais(c.bruto).toFixed(2)}, taxa ${paraReais(c.taxa).toFixed(2)}`;
}

export function descricaoDaTaxa(payoutId: string, c: ComposicaoDePayout): string {
  const n = c.quantidade;
  return `Taxa Stripe do repasse ${payoutId} (${n} ${n === 1 ? "cobrança" : "cobranças"})`;
}

export function externalIdDaTaxa(payoutId: string): string {
  return `${PREFIXO_TAXA}${payoutId}`;
}

export function externalIdDoPayout(payoutId: string): string {
  return `${PREFIXO_PAYOUT}${payoutId}`;
}

/**
 * Assinatura do Stripe: `t=<unix>,v1=<hex>[,v1=<hex>...]`. Retorna null quando o
 * cabeçalho não tem a forma esperada — chamador trata como não autenticado. A
 * comparação e o cálculo do HMAC ficam fora daqui porque dependem de Web Crypto;
 * o que é pura decisão (formato, validade, tolerância) mora neste arquivo e é
 * testável sem rede.
 */
export interface AssinaturaStripe {
  timestamp: number;
  assinaturas: string[];
}

export function leAssinaturaStripe(header: string | null): AssinaturaStripe | null {
  if (!header) return null;
  let timestamp: number | null = null;
  const assinaturas: string[] = [];
  for (const parte of header.split(",")) {
    const idx = parte.indexOf("=");
    if (idx < 0) continue;
    const chave = parte.slice(0, idx).trim();
    const valor = parte.slice(idx + 1).trim();
    if (chave === "t") {
      const n = Number(valor);
      if (Number.isFinite(n)) timestamp = n;
    } else if (chave === "v1" && valor) {
      assinaturas.push(valor);
    }
  }
  if (timestamp === null || assinaturas.length === 0) return null;
  return { timestamp, assinaturas };
}

/** Tolerância de relógio do webhook, em segundos (mesmo default do SDK oficial). */
export const TOLERANCIA_ASSINATURA_SEGUNDOS = 300;

/** Bloqueia replay: assinatura válida mas antiga é recusada. */
export function assinaturaDentroDaJanela(
  timestamp: number,
  agoraSegundos: number,
  tolerancia: number = TOLERANCIA_ASSINATURA_SEGUNDOS,
): boolean {
  return Math.abs(agoraSegundos - timestamp) <= tolerancia;
}

/** Carga assinada pelo Stripe: `${timestamp}.${corpo cru}`. */
export function cargaAssinada(timestamp: number, corpoCru: string): string {
  return `${timestamp}.${corpoCru}`;
}

/** Comparação em tempo constante — evita distinguir assinatura errada por timing. */
export function comparaEmTempoConstante(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function paraHex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** HMAC-SHA256 em hex. Usa Web Crypto, que existe igual em Deno, Node e browser. */
export async function hmacSha256Hex(segredo: string, mensagem: string): Promise<string> {
  const chave = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(segredo),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return paraHex(await crypto.subtle.sign("HMAC", chave, new TextEncoder().encode(mensagem)));
}

/**
 * A conferência completa da assinatura do Stripe, num lugar só e testável.
 *
 * Mora aqui, e não na edge function, porque é a fronteira de confiança do
 * webhook: é o único ponto que separa "o Stripe avisou que entrou dinheiro" de
 * "qualquer um postou que entrou dinheiro". Regra que decide segurança precisa
 * de teste, e teste precisa que a função seja importável sem rede.
 */
export async function assinaturaStripeConfere(
  header: string | null,
  corpoCru: string,
  webhookSecret: string,
  agoraSegundos: number = Math.floor(Date.now() / 1000),
): Promise<boolean> {
  if (!webhookSecret) return false;
  const sig = leAssinaturaStripe(header);
  if (!sig) return false;
  if (!assinaturaDentroDaJanela(sig.timestamp, agoraSegundos)) return false;
  const esperado = await hmacSha256Hex(webhookSecret, cargaAssinada(sig.timestamp, corpoCru));
  return sig.assinaturas.some((a) => comparaEmTempoConstante(a, esperado));
}

const FORMATO_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * metadata do Stripe é texto livre: quem cria a cobrança escreve o que quiser ali.
 * Jogar esse valor direto num filtro por uuid faz o Postgres recusar a consulta
 * inteira (22P02), o webhook devolve 500 e o Stripe reenvia para sempre. Conferir
 * o formato antes transforma lixo em "não achei o título", que é o certo.
 */
export function ehUuid(valor: unknown): valor is string {
  return typeof valor === "string" && FORMATO_UUID.test(valor);
}

/** Status de cobrança que já significam dinheiro reconhecido. */
export const STATUS_PAGO = ["succeeded", "paid"] as const;

export function estaPago(status: string | null | undefined): boolean {
  return !!status && (STATUS_PAGO as readonly string[]).includes(status);
}

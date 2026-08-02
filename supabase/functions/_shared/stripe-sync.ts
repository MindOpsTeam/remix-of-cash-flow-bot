/**
 * Efeitos do Stripe no ERP — o que o webhook e a API chamam em comum.
 *
 * As DECISÕES puras (composição do lote, tolerância, assinatura, classificação
 * contábil) moram em stripe-reconcile.ts e são testadas sem rede. Aqui ficam só
 * os efeitos: falar com o Stripe e escrever no banco. Manter a separação é o que
 * impede a régua de divergir entre o webhook e a sincronização manual.
 */

import {
  componhePayout,
  confereDePayout,
  creditoCasaComPayout,
  descricaoDaTaxa,
  descricaoDoPayout,
  ehUuid,
  estaPago,
  externalIdDaTaxa,
  janelaPayout,
  paraReais,
  type ItemDePayout,
} from "./stripe-reconcile.ts";

const STRIPE_API = "https://api.stripe.com/v1";

// deno-lint-ignore no-explicit-any
export type Supa = any;

export async function stripeGet(
  secretKey: string,
  caminho: string,
  params: Record<string, string> = {},
): Promise<Record<string, unknown>> {
  const qs = new URLSearchParams(params).toString();
  const r = await fetch(`${STRIPE_API}${caminho}${qs ? `?${qs}` : ""}`, {
    headers: { Authorization: `Bearer ${secretKey}` },
  });
  const j = await r.json();
  if (!r.ok) throw new Error(j?.error?.message ?? `Stripe ${r.status}`);
  return j;
}

export async function stripePost(
  secretKey: string,
  caminho: string,
  form: Record<string, string>,
): Promise<Record<string, unknown>> {
  const r = await fetch(`${STRIPE_API}${caminho}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secretKey}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams(form).toString(),
  });
  const j = await r.json();
  if (!r.ok) throw new Error(j?.error?.message ?? `Stripe ${r.status}`);
  return j;
}

/** Quem assina os lançamentos automáticos: o membro mais antigo que pode escrever. */
export async function resolveUserId(supabase: Supa, companyId: string): Promise<string | null> {
  const { data } = await supabase
    .from("company_members")
    .select("user_id")
    .eq("company_id", companyId)
    .in("role", ["admin", "member"])
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  return (data?.user_id as string) ?? null;
}

/**
 * Cobrança paga → título baixado e receita reconhecida pelo BRUTO.
 *
 * Reconhecer pelo líquido esconderia a taxa dentro da receita e distorceria a
 * receita bruta do DRE. A taxa entra depois, como despesa do repasse.
 */
export async function reconheceCobranca(
  supabase: Supa,
  companyId: string,
  charge: Record<string, unknown>,
  secretKey: string,
  configId: string,
): Promise<void> {
  const stripeId = (charge.id as string) ?? null;
  if (!stripeId) return;

  const bruto = Number(charge.amount ?? 0);
  const paymentIntent = (charge.payment_intent as string) ?? null;
  const btId = typeof charge.balance_transaction === "string" ? charge.balance_transaction : null;

  // A taxa só existe na balance transaction. Sem ela guardamos o bruto e o valor
  // se ajusta quando o repasse chegar — nunca o contrário, porque bruto errado
  // contamina a receita, e taxa faltando só adia uma despesa.
  let taxa = 0;
  let liquido = bruto;
  let payoutId: string | null = null;
  if (btId && secretKey) {
    try {
      const bt = await stripeGet(secretKey, `/balance_transactions/${btId}`);
      taxa = Number(bt.fee ?? 0);
      liquido = Number(bt.net ?? bruto - taxa);
      payoutId = typeof bt.payout === "string" ? bt.payout : null;
    } catch (e) {
      console.error("[stripe] balance_transaction falhou", e);
    }
  }

  await supabase.from("stripe_charges").upsert(
    {
      company_id: companyId,
      // O canal é parte da identidade: dois canais da mesma empresa podem, em
      // tese, ter cobranças de mesmo id, e sem isto uma sobrescreveria a outra.
      config_id: configId,
      stripe_id: stripeId,
      balance_transaction_id: btId,
      payout_id: payoutId,
      status: (charge.status as string) ?? null,
      amount_bruto: bruto,
      amount_taxa: taxa,
      amount_liquido: liquido,
      currency: ((charge.currency as string) ?? "brl").toLowerCase(),
      description: (charge.description as string) ?? null,
      customer_email:
        (charge.receipt_email as string) ??
        ((charge.billing_details as Record<string, unknown>)?.email as string) ??
        null,
      paid_at: charge.created ? new Date(Number(charge.created) * 1000).toISOString() : null,
      raw: charge,
    },
    { onConflict: "config_id,stripe_id" },
  );

  if (!estaPago((charge.status as string) ?? null)) return;

  // metadata vem de fora e é texto livre. Sem conferir o formato, um valor
  // inválido derruba a consulta por uuid (22P02) e o webhook entra em laço de
  // reenvio. Com a checagem, lixo vira apenas "título não encontrado".
  const metaId = (charge.metadata as Record<string, unknown>)?.receivable_id;
  const receivableId = ehUuid(metaId) ? metaId : null;
  let titulo: Record<string, unknown> | null = null;

  const colunas = "id, amount, transaction_id, account_id, cost_center_id, description, contact_id";
  if (receivableId) {
    const { data } = await supabase
      .from("receivables").select(colunas)
      .eq("company_id", companyId).eq("id", receivableId).maybeSingle();
    titulo = data ?? null;
  }
  if (!titulo && paymentIntent) {
    const { data } = await supabase
      .from("receivables").select(colunas)
      .eq("company_id", companyId).eq("stripe_payment_intent_id", paymentIntent).maybeSingle();
    titulo = data ?? null;
  }
  if (!titulo) return; // cobrança avulsa fica registrada, sem virar receita solta

  const dataPagamento = charge.created
    ? new Date(Number(charge.created) * 1000).toISOString().slice(0, 10)
    : new Date().toISOString().slice(0, 10);

  await supabase
    .from("receivables")
    .update({ status: "recebido", payment_date: dataPagamento })
    .eq("id", titulo.id as string)
    .neq("status", "recebido");

  const ligaCobranca = (patch: Record<string, unknown>) =>
    supabase.from("stripe_charges").update(patch)
      .eq("config_id", configId).eq("stripe_id", stripeId);

  if (titulo.transaction_id) {
    await ligaCobranca({ receivable_id: titulo.id, transaction_id: titulo.transaction_id });
    return;
  }

  // Anti-duplicidade forte: external_id é único por cobrança.
  const { data: dup } = await supabase
    .from("transactions").select("id")
    .eq("company_id", companyId).eq("external_id", stripeId).maybeSingle();
  if (dup?.id) {
    await supabase.from("receivables").update({ transaction_id: dup.id }).eq("id", titulo.id as string);
    await ligaCobranca({ receivable_id: titulo.id, transaction_id: dup.id });
    return;
  }

  // Sem classificação a receita não entra sozinha no DRE — mesma regra do Asaas,
  // para não poluir o resultado com lançamento sem conta nem centro de custo.
  if (!titulo.account_id || !titulo.cost_center_id) {
    await ligaCobranca({ receivable_id: titulo.id });
    return;
  }

  const userId = await resolveUserId(supabase, companyId);
  if (!userId) return;

  const { data: tx } = await supabase
    .from("transactions")
    .insert({
      company_id: companyId,
      user_id: userId,
      date: dataPagamento,
      description: (titulo.description as string) ?? "Cobrança Stripe",
      amount: paraReais(bruto), // BRUTO, sempre
      type: "revenue",
      account_id: titulo.account_id,
      cost_center_id: titulo.cost_center_id,
      status: "confirmed",
      source: "receivable",
      external_id: stripeId,
    })
    .select("id")
    .single();

  if (tx?.id) {
    await supabase.from("receivables").update({ transaction_id: tx.id }).eq("id", titulo.id as string);
    await ligaCobranca({ receivable_id: titulo.id, transaction_id: tx.id });
  }
}

/**
 * Repasse → monta e confere a composição do lote (N cobranças + taxas = 1 crédito).
 *
 * Aqui NÃO se lança receita: ela já foi reconhecida bruta em cada cobrança. O que
 * este passo produz é a composição conferida, que é o que permite a conciliação
 * casar N:1 em vez de tentar valor exato 1:1 e falhar sempre.
 */
export async function componhoRepasse(
  supabase: Supa,
  companyId: string,
  secretKey: string,
  payout: Record<string, unknown>,
  configId: string,
): Promise<{ fecha: boolean; diferenca: number; itens: number }> {
  const payoutId = payout.id as string;
  if (!payoutId) return { fecha: false, diferenca: 0, itens: 0 };

  const itens: ItemDePayout[] = [];
  let startingAfter: string | undefined;

  // Pagina até o fim. Lote parcial produz diferença e trava a conciliação — que é
  // o comportamento certo, mas aqui queremos o lote inteiro de verdade.
  for (let pagina = 0; pagina < 40; pagina++) {
    const params: Record<string, string> = { payout: payoutId, limit: "100" };
    if (startingAfter) params.starting_after = startingAfter;
    const lista = await stripeGet(secretKey, "/balance_transactions", params);
    const dados = (lista.data as Record<string, unknown>[]) ?? [];
    for (const bt of dados) {
      // A própria linha do repasse aparece no extrato; ela não é item do lote.
      if ((bt.type as string) === "payout") continue;
      itens.push({
        id: bt.id as string,
        tipo: (bt.type as string) ?? "charge",
        bruto: Number(bt.amount ?? 0),
        taxa: Number(bt.fee ?? 0),
        liquido: Number(bt.net ?? 0),
        origem: typeof bt.source === "string" ? bt.source : null,
      });
    }
    if (!lista.has_more || dados.length === 0) break;
    startingAfter = dados[dados.length - 1].id as string;
  }

  const composicao = componhePayout(itens);
  const conferencia = confereDePayout(Number(payout.amount ?? 0), itens);

  await supabase.from("stripe_payouts").upsert(
    {
      company_id: companyId,
      config_id: configId,
      stripe_id: payoutId,
      status: (payout.status as string) ?? null,
      amount_liquido: Number(payout.amount ?? 0),
      amount_bruto: composicao.bruto,
      amount_taxa: composicao.taxa,
      itens: composicao.quantidade,
      currency: ((payout.currency as string) ?? "brl").toLowerCase(),
      arrival_date: payout.arrival_date
        ? new Date(Number(payout.arrival_date) * 1000).toISOString().slice(0, 10)
        : null,
      composicao_fecha: conferencia.fecha,
      diferenca: conferencia.diferenca,
      raw: payout,
    },
    { onConflict: "config_id,stripe_id" },
  );

  // Liga cada cobrança ao repasse: é por aqui que a tela mostra "este depósito de
  // R$ X é composto por estas N vendas".
  for (const item of itens) {
    if (!item.origem) continue;
    await supabase
      .from("stripe_charges")
      .update({
        payout_id: payoutId,
        amount_taxa: item.taxa,
        amount_liquido: item.liquido,
        balance_transaction_id: item.id,
      })
      .eq("config_id", configId)
      .eq("stripe_id", item.origem);
  }

  return { fecha: conferencia.fecha, diferenca: conferencia.diferenca, itens: composicao.quantidade };
}

export interface ResultadoConciliacao {
  status: "conciliado" | "sem_credito" | "nao_fecha" | "ja_conciliado" | "duplicidade";
  mensagem: string;
  taxa_lancada?: boolean;
  duplicidade_transaction_id?: string;
}

/**
 * Concilia o repasse contra o extrato — a régua N:1 que a conciliação comum não faz.
 *
 * Três coisas acontecem, e a ordem importa:
 *   1. Acha no extrato o crédito de valor igual ao LÍQUIDO do repasse, na janela
 *      da data prevista de chegada.
 *   2. Marca essa linha como ignorada, NÃO como receita. A receita das cobranças
 *      já está no DRE pelo bruto; virar o depósito em receita faturaria o mesmo
 *      dinheiro duas vezes, agora pelo líquido.
 *   3. Lança a taxa como despesa do período, uma vez por repasse (idempotente pelo
 *      external_id). Sem esse lançamento o lucro fica superavaliado exatamente no
 *      valor das taxas.
 */
export async function conciliaRepasse(
  supabase: Supa,
  companyId: string,
  payoutStripeId: string,
  configId: string,
): Promise<ResultadoConciliacao> {
  const { data: payout } = await supabase
    .from("stripe_payouts")
    .select("*")
    .eq("company_id", companyId)
    .eq("config_id", configId)
    .eq("stripe_id", payoutStripeId)
    .maybeSingle();

  if (!payout) return { status: "sem_credito", mensagem: "Repasse não encontrado." };

  if (payout.bank_raw_id || payout.bank_transaction_id) {
    // Já conciliado, mas a taxa pode ter ficado para trás (mês fechado na hora,
    // conta da taxa ainda não definida). Sem esta segunda chance a despesa se
    // perderia para sempre e o lucro ficaria maior do que é.
    if (Number(payout.amount_taxa) > 0 && !payout.taxa_transaction_id) {
      const t = await lancaTaxaDoRepasse(supabase, companyId, payout);
      return t.txId
        ? { status: "conciliado", mensagem: `Faltava só a taxa, agora lançada. ${t.aviso}`.trim(), taxa_lancada: true }
        : { status: "nao_fecha", mensagem: `Repasse já conciliado, mas a taxa continua pendente. ${t.aviso}`.trim() };
    }
    return { status: "ja_conciliado", mensagem: "Este repasse já foi conciliado." };
  }
  if (!payout.composicao_fecha) {
    return {
      status: "nao_fecha",
      mensagem:
        `A soma das cobranças não reproduz o valor do repasse (diferença de ` +
        `${paraReais(Math.abs(payout.diferenca)).toFixed(2)}). Sincronize de novo antes de conciliar.`,
    };
  }

  const liquido = Number(payout.amount_liquido);
  const { de, ate } = janelaPayout(payout.arrival_date ?? new Date().toISOString());

  // 1) Crédito ainda no staging: caminho limpo, a linha nunca vira receita.
  const { data: candidatos } = await supabase
    .from("bank_transactions_raw")
    .select("id, amount, date, description")
    .eq("company_id", companyId)
    .eq("status", "new")
    .eq("direction", "revenue")
    .gte("date", de)
    .lte("date", ate);

  const linha = (candidatos ?? []).find((c: Record<string, unknown>) =>
    creditoCasaComPayout(Number(c.amount), liquido)
  );

  if (!linha) {
    // 2) Já importado como receita? Então o dinheiro está contado duas vezes: uma
    //    no bruto das cobranças, outra no depósito. Não corrigimos sozinhos — um
    //    lançamento que alguém pode ter classificado à mão não some sem aviso.
    const { data: jaImportado } = await supabase
      .from("transactions")
      .select("id, description, amount")
      .eq("company_id", companyId)
      .eq("type", "revenue")
      .gte("date", de)
      .lte("date", ate);

    const dup = (jaImportado ?? []).find((t: Record<string, unknown>) =>
      creditoCasaComPayout(Number(t.amount), liquido)
    );
    if (dup) {
      return {
        status: "duplicidade",
        mensagem:
          "O crédito deste repasse já foi lançado como receita. A receita das " +
          "cobranças já está no DRE pelo bruto, então esse lançamento duplica o " +
          "faturamento. Revise antes de conciliar.",
        duplicidade_transaction_id: dup.id as string,
      };
    }
    return {
      status: "sem_credito",
      mensagem: `Nenhum crédito de ${paraReais(liquido).toFixed(2)} no extrato entre ${de} e ${ate}.`,
    };
  }

  const composicao = {
    quantidade: Number(payout.itens),
    bruto: Number(payout.amount_bruto),
    taxa: Number(payout.amount_taxa),
    liquido,
  };

  // Claim atômico: duas abas conciliando o mesmo repasse não podem ambas marcar a
  // linha. Quem perder vê 0 linhas afetadas e para.
  const { data: reivindicada } = await supabase
    .from("bank_transactions_raw")
    .update({ status: "ignored" })
    .eq("id", linha.id)
    .eq("status", "new")
    .select("id");
  if (!reivindicada || reivindicada.length === 0) {
    return { status: "ja_conciliado", mensagem: "Outra sessão conciliou este repasse agora." };
  }

  // 3) Taxa vira despesa do período, uma vez por repasse.
  const taxa = await lancaTaxaDoRepasse(supabase, companyId, {
    stripe_id: payoutStripeId,
    arrival_date: payout.arrival_date,
    amount_taxa: composicao.taxa,
    itens: composicao.quantidade,
    amount_bruto: composicao.bruto,
    amount_liquido: liquido,
  });

  await supabase
    .from("stripe_payouts")
    .update({
      bank_raw_id: linha.id,
      taxa_transaction_id: taxa.txId,
      conciliado_em: new Date().toISOString(),
    })
    .eq("config_id", configId)
    .eq("stripe_id", payoutStripeId);

  return {
    status: "conciliado",
    mensagem: `${descricaoDoPayout(payoutStripeId, composicao)}. ${taxa.aviso}`.trim(),
    taxa_lancada: taxa.lancadaAgora,
  };
}

/**
 * Lança a taxa do repasse como despesa do período — e nunca falha calado.
 *
 * Este lançamento é o que impede o lucro de ficar maior do que é. Ele pode ser
 * legitimamente recusado (mês fechado é uma proteção do sistema, não um bug), e
 * quando isso acontece o motivo tem que chegar à tela: a conciliação continua
 * válida, mas com uma despesa pendente que alguém precisa resolver.
 */
async function lancaTaxaDoRepasse(
  supabase: Supa,
  companyId: string,
  payout: {
    stripe_id: string;
    arrival_date: string | null;
    amount_taxa: number;
    itens: number;
    amount_bruto: number;
    amount_liquido: number;
  },
): Promise<{ txId: string | null; lancadaAgora: boolean; aviso: string }> {
  const valorTaxa = Number(payout.amount_taxa);
  if (valorTaxa <= 0) return { txId: null, lancadaAgora: false, aviso: "" };

  const externalId = externalIdDaTaxa(payout.stripe_id);

  const { data: existente } = await supabase
    .from("transactions").select("id")
    .eq("company_id", companyId).eq("external_id", externalId).maybeSingle();
  if (existente?.id) return { txId: existente.id as string, lancadaAgora: false, aviso: "" };

  const { data: config } = await supabase
    .from("stripe_config").select("conta_taxa_id, centro_custo_taxa_id")
    .eq("company_id", companyId).maybeSingle();
  if (!config?.conta_taxa_id || !config?.centro_custo_taxa_id) {
    return {
      txId: null,
      lancadaAgora: false,
      aviso:
        `A taxa de ${paraReais(valorTaxa).toFixed(2)} NÃO foi lançada: defina a conta ` +
        "e o centro de custo da taxa nas configurações do Stripe. Enquanto isso o lucro fica maior do que é.",
    };
  }

  const userId = await resolveUserId(supabase, companyId);
  if (!userId) {
    return { txId: null, lancadaAgora: false, aviso: "A taxa não foi lançada: a empresa não tem membro que possa escrever." };
  }

  const composicao = {
    quantidade: Number(payout.itens),
    bruto: Number(payout.amount_bruto),
    taxa: valorTaxa,
    liquido: Number(payout.amount_liquido),
  };

  const { data: tx, error } = await supabase
    .from("transactions")
    .insert({
      company_id: companyId,
      user_id: userId,
      date: payout.arrival_date ?? new Date().toISOString().slice(0, 10),
      description: descricaoDaTaxa(payout.stripe_id, composicao),
      amount: paraReais(valorTaxa),
      type: "expense",
      account_id: config.conta_taxa_id,
      cost_center_id: config.centro_custo_taxa_id,
      status: "confirmed",
      source: "reconciled",
      external_id: externalId,
    })
    .select("id")
    .single();

  if (error) {
    // Mês fechado é o caso comum e é proteção legítima. Silenciar aqui seria o
    // pior desfecho possível: conciliação "bem-sucedida" com despesa sumida.
    console.error("[stripe] taxa do repasse não pôde ser lançada", error);
    const fechado = String(error.message ?? "").includes("fechado");
    return {
      txId: null,
      lancadaAgora: false,
      aviso: fechado
        ? `A taxa de ${paraReais(valorTaxa).toFixed(2)} NÃO entrou porque o mês do repasse está fechado. ` +
          "Reabra o período e concilie de novo só para lançar a taxa."
        : `A taxa de ${paraReais(valorTaxa).toFixed(2)} NÃO foi lançada: ${error.message}`,
    };
  }

  return { txId: (tx?.id as string) ?? null, lancadaAgora: !!tx?.id, aviso: "" };
}

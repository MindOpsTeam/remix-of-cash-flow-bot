/**
 * Open Finance — sync on-demand, varredura por cron e importação p/ transactions.
 *
 * POST /openfinance-sync
 *   header x-cron-secret                                 → varre TODAS as conexões ativas
 *   { action: "sync", company_id, connection_id }        → puxa incrementais para o staging
 *   { action: "import", company_id, items: [...] }       → staging → transactions, revisado e classificado
 *   { action: "import", company_id, raw_ids: [...] }     → formato legado (sem classificação)
 *   { action: "ignore", company_id, raw_ids: [...] }     → marca staging como ignorado
 *
 * Regra do import: o humano já revisou na Caixa de entrada, então o lançamento
 * entra `confirmed` e classificado — é isso que o faz aparecer no DRE. Antes de
 * inserir, procura um lançamento digitado (manual/whatsapp/receivable/texto/
 * contrato) com o mesmo valor na janela de ±3 dias e ADOTA em vez de duplicar,
 * espelhando a régua do reconcile-transactions.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.97.0";
import { authenticate, assertMembership, assertCanWrite, jsonResp } from "../_shared/auth.ts";
import { getCorsHeaders } from "../_shared/cors.ts";
import { syncPluggyConnection } from "../_shared/openfinance-sync.ts";
import {
  parseImportItems,
  janelaConciliacao,
  FONTES_CONCILIAVEIS,
} from "../_shared/openfinance-import.ts";

Deno.serve(async (req) => {
  const service = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // Varredura agendada: sem JWT, autentica pelo segredo do cron (padrão dos
  // agentes). O webhook da Pluggy cobre o push; o cron cobre conexões sem
  // webhook e o drift de consentimento.
  const cronSecret = Deno.env.get("CRON_SECRET");
  if (cronSecret && req.headers.get("x-cron-secret") === cronSecret) {
    const corsHeaders = getCorsHeaders(req);
    try {
      const { data: conns } = await service
        .from("bank_connections")
        .select("id, company_id, external_id, last_synced_at, history_calls_month, history_calls_reset_at")
        .neq("status", "disconnected");

      let ok = 0;
      let falhas = 0;
      let staged = 0;
      for (const conn of conns ?? []) {
        try {
          const r = await syncPluggyConnection(service, conn, { initial: false });
          staged += r?.staged ?? 0;
          ok += 1;
        } catch (err) {
          falhas += 1;
          console.error(`[openfinance-sync] cron: conexão ${conn.id} falhou`, err);
        }
      }
      return jsonResp({ ok: true, conexoes: (conns ?? []).length, sincronizadas: ok, falhas, staged }, 200, corsHeaders);
    } catch (err) {
      console.error("[openfinance-sync] cron error", err);
      return jsonResp({ error: String(err) }, 500, corsHeaders);
    }
  }

  const auth = await authenticate(req);
  if (auth instanceof Response) return auth;
  const { user, supabase, corsHeaders } = auth;

  try {
    const body = await req.json().catch(() => ({}));
    const action = body.action as string;
    const companyId = body.company_id as string | undefined;
    if (!companyId) return jsonResp({ error: "company_id é obrigatório" }, 400, corsHeaders);
    const forbidden = await assertMembership(supabase, user.id, companyId, corsHeaders);
    if (forbidden) return forbidden;
    // sync/ignore/import mutam o palco — barrar papel somente leitura (demo).
    const readonly = await assertCanWrite(supabase, user.id, companyId, corsHeaders);
    if (readonly) return readonly;

    if (action === "sync") {
      const connectionId = body.connection_id as string;
      const { data: conn, error } = await service
        .from("bank_connections")
        .select("id, company_id, external_id, last_synced_at, history_calls_month, history_calls_reset_at")
        .eq("id", connectionId)
        .eq("company_id", companyId)
        .single();
      if (error || !conn) return jsonResp({ error: "conexão não encontrada" }, 404, corsHeaders);
      const result = await syncPluggyConnection(service, conn, { initial: false });
      return jsonResp({ ok: true, ...result }, 200, corsHeaders);
    }

    if (action === "ignore") {
      const rawIds = (body.raw_ids as string[]) ?? [];
      if (rawIds.length === 0) return jsonResp({ error: "raw_ids vazio" }, 400, corsHeaders);
      const { error } = await service
        .from("bank_transactions_raw")
        .update({ status: "ignored" })
        .eq("company_id", companyId)
        .eq("status", "new")
        .in("id", rawIds);
      if (error) throw error;
      return jsonResp({ ok: true, ignoradas: rawIds.length }, 200, corsHeaders);
    }

    /**
     * Fecha o loop com o título em aberto.
     *
     * Sem isto, quando o extrato chega ANTES da baixa manual o dinheiro entra
     * no DRE como receita nova e o título continua "a receber" — o humano vê o
     * título aberto, dá baixa e a receita DUPLICA. Aqui o crédito/débito
     * bancário procura um título compatível e o liquida, ligando os dois.
     *
     * Régua conservadora de propósito: valor EXATO, título ainda em aberto e
     * sem lançamento ligado, com vencimento numa janela que cobre atraso
     * (até 60 dias) e antecipação (até 15). Na dúvida não casa — título aberto
     * a mais é erro visível; baixa errada é erro invisível.
     */
    async function baixarTituloAberto(
      tipo: "revenue" | "expense",
      valor: number,
      dataIso: string,
      transactionId: string,
    ): Promise<"receivable" | "bill" | null> {
      const base = new Date(`${dataIso.slice(0, 10)}T00:00:00Z`);
      const desloca = (n: number) => {
        const d = new Date(base);
        d.setUTCDate(d.getUTCDate() + n);
        return d.toISOString().slice(0, 10);
      };
      const de = desloca(-60);
      const ate = desloca(15);

      if (tipo === "revenue") {
        const { data: titulo } = await service
          .from("receivables")
          .select("id")
          .eq("company_id", companyId)
          .in("status", ["a_receber", "vencido"])
          .is("transaction_id", null)
          .eq("amount", valor)
          .gte("due_date", de)
          .lte("due_date", ate)
          .order("due_date", { ascending: true })
          .limit(1)
          .maybeSingle();
        if (!titulo) return null;
        const { data: baixado } = await service
          .from("receivables")
          .update({ status: "recebido", payment_date: dataIso.slice(0, 10), transaction_id: transactionId })
          .eq("id", titulo.id)
          .is("transaction_id", null)   // outra linha pode ter baixado no meio
          .select("id");
        return baixado && baixado.length > 0 ? "receivable" : null;
      }

      const { data: conta } = await service
        .from("bills_payable")
        .select("id")
        .eq("company_id", companyId)
        .neq("status", "pago")
        .eq("valor", valor)
        .gte("vencimento", de)
        .lte("vencimento", ate)
        .order("vencimento", { ascending: true })
        .limit(1)
        .maybeSingle();
      if (!conta) return null;
      const { data: pago } = await service
        .from("bills_payable")
        .update({ status: "pago" })
        .eq("id", conta.id)
        .neq("status", "pago")
        .select("id");
      return pago && pago.length > 0 ? "bill" : null;
    }

    if (action === "import") {
      const items = parseImportItems(body);
      if (items.length === 0) return jsonResp({ error: "nenhum item para importar" }, 400, corsHeaders);

      const { data: rows, error } = await service
        .from("bank_transactions_raw")
        .select("*")
        .eq("company_id", companyId)
        .in("id", items.map((i) => i.raw_id))
        .eq("status", "new");
      if (error) throw error;

      const porRawId = new Map(items.map((i) => [i.raw_id, i]));
      let imported = 0;
      let reconciled = 0;
      let skipped = 0;
      let falhas = 0;
      let titulosBaixados = 0;

      for (const r of rows ?? []) {
        const item = porRawId.get(r.id);
        const tipo = r.direction === "revenue" ? "revenue" : "expense";

        // 0) Reivindica a linha do staging ANTES de qualquer decisão. Duas
        //    sessões importando o mesmo lote (duas abas) passariam ambas pelo
        //    SELECT inicial; o UPDATE condicional garante que só uma processa
        //    cada linha — a outra vê 0 linhas afetadas e pula.
        const { data: claimed } = await service
          .from("bank_transactions_raw")
          .update({ status: "importing" })
          .eq("id", r.id)
          .eq("status", "new")
          .select("id");
        if (!claimed || claimed.length === 0) {
          skipped += 1;
          continue;
        }

        // 1) Já entrou por outra via com o mesmo external_id? Não duplica.
        if (r.external_id) {
          const { data: existente } = await service
            .from("transactions")
            .select("id")
            .eq("company_id", companyId)
            .eq("external_id", r.external_id)
            .maybeSingle();
          if (existente) {
            await service
              .from("bank_transactions_raw")
              .update({ status: "imported", transaction_id: existente.id })
              .eq("id", r.id);
            skipped += 1;
            continue;
          }
        }

        // 2) O humano já digitou esse dinheiro? Adota o lançamento dele em vez
        //    de criar um segundo (régua do reconcile: mesma direção, mesmo
        //    valor, ±3 dias, fonte digitada, ainda sem par bancário). O update
        //    re-checa `external_id IS NULL`: se outra linha do banco adotou o
        //    mesmo candidato no meio do caminho, 0 linhas voltam e esta cai no
        //    insert — dois movimentos nunca se fundem num só lançamento.
        const { de, ate } = janelaConciliacao(r.date);
        const { data: candidato } = await service
          .from("transactions")
          .select("id")
          .eq("company_id", companyId)
          .eq("type", tipo)
          .eq("amount", r.amount)
          .is("external_id", null)
          .in("source", [...FONTES_CONCILIAVEIS])
          .gte("date", de)
          .lte("date", ate)
          .limit(1)
          .maybeSingle();

        if (candidato) {
          const { data: adotado } = await service
            .from("transactions")
            .update({ external_id: r.external_id, source: "reconciled", status: "reconciled" })
            .eq("id", candidato.id)
            .is("external_id", null)
            .select("id");
          if (adotado && adotado.length > 0) {
            await service
              .from("bank_transactions_raw")
              .update({ status: "imported", transaction_id: candidato.id })
              .eq("id", r.id);
            if (await baixarTituloAberto(tipo, Number(r.amount), r.date, candidato.id)) titulosBaixados += 1;
            reconciled += 1;
            continue;
          }
        }

        // 3) Lançamento novo: revisado pelo humano na Caixa de entrada, então
        //    entra confirmado e classificado — e portanto no DRE.
        const { data: tx, error: txErr } = await service
          .from("transactions")
          .insert({
            company_id: companyId,
            user_id: user.id,
            date: r.date,
            description: r.description,
            amount: r.amount,
            type: tipo,
            status: "confirmed",
            source: "openfinance",
            external_id: r.external_id,
            account_id: item?.account_id ?? null,
            cost_center_id: item?.cost_center_id ?? null,
            payment_method: r.payment_method ?? null,
          })
          .select("id")
          .single();
        if (txErr) {
          // Mês fechado (gatilho) ou colisão: devolve a linha ao staging para
          // não ficar presa em "importing" invisível para sempre.
          console.error("[openfinance-sync] import: insert falhou", txErr);
          await service.from("bank_transactions_raw").update({ status: "new" }).eq("id", r.id);
          falhas += 1;
          continue;
        }
        await service
          .from("bank_transactions_raw")
          .update({ status: "imported", transaction_id: tx.id })
          .eq("id", r.id);
        if (await baixarTituloAberto(tipo, Number(r.amount), r.date, tx.id)) titulosBaixados += 1;
        imported += 1;
      }

      return jsonResp({ ok: true, imported, reconciled, skipped, falhas, titulos_baixados: titulosBaixados }, 200, corsHeaders);
    }

    return jsonResp({ error: `Ação inválida: ${action}` }, 400, corsHeaders);
  } catch (err) {
    console.error("[openfinance-sync] error", err);
    return jsonResp({ error: String(err) }, 500, corsHeaders);
  }
});

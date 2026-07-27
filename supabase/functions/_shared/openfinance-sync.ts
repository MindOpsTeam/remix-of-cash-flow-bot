/**
 * Ingestão Open Finance: puxa contas/transações do provedor e grava no staging
 * bank_transactions_raw (dedupe por external_id). Usado por openfinance-connect
 * (sync inicial), openfinance-sync (on-demand) e openfinance-webhook.
 */

import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.97.0";
import { pluggyAuth, listAccounts, listTransactions, getItem, pluggyCredsForCompany } from "./pluggy.ts";
import {
  mapPluggyTransaction,
  normalizePluggyStatus,
  type PluggyTransaction,
} from "./openfinance-map.ts";

const OFB_HISTORY_CALLS_LIMIT = 8;

interface SyncResult {
  accounts: number;
  staged: number;
  status: string;
}

/**
 * Sincroniza uma conexão Pluggy: atualiza status, contas e escalona transações.
 * `initial=true` puxa histórico (respeitando o limite mensal); senão, incremental.
 */
export async function syncPluggyConnection(
  supabase: SupabaseClient,
  connection: {
    id: string;
    company_id: string;
    external_id: string;
    last_synced_at: string | null;
    history_calls_month: number;
    history_calls_reset_at: string;
  },
  opts: { initial?: boolean } = {},
): Promise<SyncResult> {
  // Credencial da empresa dona da conexão (Vault), com fallback no env.
  const apiKey = await pluggyAuth(await pluggyCredsForCompany(supabase, connection.company_id));

  // Status do item
  const item = await getItem(apiKey, connection.external_id);
  const status = normalizePluggyStatus(item.status);

  // Reseta contador de histórico se virou o mês
  const thisMonth = new Date().toISOString().slice(0, 7);
  const resetMonth = (connection.history_calls_reset_at ?? "").slice(0, 7);
  let historyCalls = resetMonth === thisMonth ? connection.history_calls_month : 0;

  const accounts = await listAccounts(apiKey, connection.external_id);

  // Upsert das contas bancárias
  for (const acc of accounts) {
    await supabase.from("bank_accounts").upsert(
      {
        company_id: connection.company_id,
        connection_id: connection.id,
        external_id: acc.id,
        name: acc.marketingName || acc.name,
        bank_name: item.connector?.name ?? null,
        account_type: `${acc.type}/${acc.subtype}`,
        balance: acc.balance,
        last_synced_at: new Date().toISOString(),
      },
      { onConflict: "external_id" },
    );
  }

  // Define a janela de datas
  let dateFrom: string | undefined;
  if (opts.initial) {
    if (historyCalls >= OFB_HISTORY_CALLS_LIMIT) {
      // Estourou o limite mensal do histórico — pega só ~30 dias
      dateFrom = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
    } else {
      dateFrom = new Date(Date.now() - 365 * 86400000).toISOString().slice(0, 10);
      historyCalls += 1;
    }
  } else if (connection.last_synced_at) {
    // Incremental: desde a última sync menos 3 dias de folga
    dateFrom = new Date(new Date(connection.last_synced_at).getTime() - 3 * 86400000)
      .toISOString()
      .slice(0, 10);
  }

  let staged = 0;
  for (const acc of accounts) {
    const txs = (await listTransactions(apiKey, acc.id, { dateFrom, maxPages: 10 })) as PluggyTransaction[];
    for (const t of txs) {
      const n = mapPluggyTransaction(t);
      const { error } = await supabase.from("bank_transactions_raw").insert({
        company_id: connection.company_id,
        connection_id: connection.id,
        provider: "pluggy",
        external_id: n.external_id,
        account_external_id: n.account_external_id,
        date: n.date,
        description: n.description,
        amount: n.amount,
        direction: n.direction,
        category: n.category,
        payment_method: n.payment_method,
        raw: t as unknown as Record<string, unknown>,
      });
      if (!error) staged += 1; // erro provável = dedupe (unique), ignora
    }
  }

  await supabase
    .from("bank_connections")
    .update({
      status,
      institution_name: item.connector?.name ?? null,
      institution_image: item.connector?.imageUrl ?? null,
      consent_expires_at: item.consentExpiresAt ?? null,
      last_synced_at: new Date().toISOString(),
      history_calls_month: historyCalls,
      history_calls_reset_at: `${thisMonth}-01`,
      updated_at: new Date().toISOString(),
    })
    .eq("id", connection.id);

  return { accounts: accounts.length, staged, status };
}

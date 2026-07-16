/**
 * Shared Asaas event processor for webhook handlers.
 * Processes events into structured company_asaas_* tables.
 */

// deno-lint-ignore no-explicit-any
type SupabaseClient = any;

interface ProcessResult {
  table: string;
  processed: boolean;
}

export async function processEvent(
  supabase: SupabaseClient,
  companyId: string,
  eventCategory: string,
  body: Record<string, unknown>,
): Promise<ProcessResult | null> {
  const tablePrefix = "company_asaas_";
  const conflictKey = "company_id,asaas_id";

  switch (eventCategory) {
    case "PAYMENT": {
      const p = body.payment as Record<string, unknown> | undefined;
      if (!p) return null;
      await supabase
        .from(`${tablePrefix}payments`)
        .upsert({
          company_id: companyId,
          asaas_id: p.id as string,
          customer_id: p.customer as string || null,
          subscription_id: p.subscription as string || null,
          installment_id: p.installment as string || null,
          payment_link: p.paymentLink as string || null,
          billing_type: p.billingType as string || null,
          status: p.status as string,
          value: p.value as number || null,
          net_value: p.netValue as number || null,
          description: p.description as string || null,
          external_reference: p.externalReference as string || null,
          due_date: p.dueDate as string || null,
          payment_date: p.paymentDate as string || null,
          confirmed_date: p.confirmedDate as string || null,
          credit_date: p.creditDate as string || null,
          invoice_url: p.invoiceUrl as string || null,
          bank_slip_url: p.bankSlipUrl as string || null,
          pix_transaction: p.pixTransaction || null,
          credit_card: p.creditCard || null,
          discount: p.discount || null,
          fine: p.fine || null,
          interest: p.interest || null,
          split: p.split || null,
          chargeback: p.chargeback || null,
          refunds: p.refunds || null,
          raw_payload: p,
      }, { onConflict: conflictKey });

      // Fecha o loop: espelha em receivables e, no recebimento, lança receita no DRE.
      await syncReceivableFromPayment(supabase, companyId, p);

      return { table: `${tablePrefix}payments`, processed: true };
    }

    case "TRANSFER": {
      const t = body.transfer as Record<string, unknown> | undefined;
      if (!t) return null;
      await supabase
        .from(`${tablePrefix}transfers`)
        .upsert({
          company_id: companyId,
          asaas_id: t.id as string,
          type: t.type as string || null,
          status: t.status as string,
          value: t.value as number || null,
          net_value: t.netValue as number || null,
          fee: t.fee as number || null,
          transfer_fee: t.transferFee as number || null,
          description: t.description as string || null,
          bank_account: t.bankAccount || null,
          scheduled_date: t.scheduleDate as string || t.scheduledDate as string || null,
          transaction_receipt_url: t.transactionReceiptUrl as string || null,
          authorized: t.authorized as boolean ?? null,
          operation_type: t.operationType as string || null,
          external_reference: t.externalReference as string || null,
          raw_payload: t,
        }, { onConflict: conflictKey });

      return { table: `${tablePrefix}transfers`, processed: true };
    }

    case "BILL": {
      const b = body.bill as Record<string, unknown> | undefined;
      if (!b) return null;
      await supabase
        .from(`${tablePrefix}bills`)
        .upsert({
          company_id: companyId,
          asaas_id: b.id as string,
          status: b.status as string,
          value: b.value as number || null,
          fee: b.fee as number || null,
          description: b.description as string || null,
          company_name: b.companyName as string || null,
          identification_field: b.identificationField as string || null,
          type: b.type as string || null,
          due_date: b.dueDate as string || null,
          schedule_date: b.scheduleDate as string || null,
          payment_date: b.paymentDate as string || null,
          can_be_cancelled: b.canBeCancelled as boolean ?? null,
          failure_reason: b.failureReason as string || null,
          raw_payload: b,
        }, { onConflict: conflictKey });

      return { table: `${tablePrefix}bills`, processed: true };
    }

    case "SUBSCRIPTION": {
      const s = body.subscription as Record<string, unknown> | undefined;
      if (!s) return null;
      await supabase
        .from(`${tablePrefix}subscriptions`)
        .upsert({
          company_id: companyId,
          asaas_id: s.id as string,
          customer_id: s.customer as string || null,
          billing_type: s.billingType as string || null,
          status: s.status as string,
          value: s.value as number || null,
          next_due_date: s.nextDueDate as string || null,
          cycle: s.cycle as string || null,
          description: s.description as string || null,
          discount: s.discount || null,
          fine: s.fine || null,
          interest: s.interest || null,
          split: s.split || null,
          max_payments: s.maxPayments as number ?? null,
          payment_count: s.paymentCount as number ?? null,
          external_reference: s.externalReference as string || null,
          end_date: s.endDate as string || null,
          raw_payload: s,
        }, { onConflict: conflictKey });
      return { table: `${tablePrefix}subscriptions`, processed: true };
    }

    case "INVOICE": {
      const inv = body.invoice as Record<string, unknown> | undefined;
      if (!inv) return null;
      await supabase
        .from(`${tablePrefix}invoices`)
        .upsert({
          company_id: companyId,
          asaas_id: inv.id as string,
          payment_id: inv.payment as string || null,
          status: inv.status as string,
          number: inv.number as string || null,
          service_description: inv.serviceDescription as string || null,
          value: inv.value as number || null,
          net_value: inv.netValue as number || null,
          observations: inv.observations as string || null,
          taxes: inv.taxes || null,
          customer_id: inv.customer as string || null,
          effective_date: inv.effectiveDate as string || null,
          external_reference: inv.externalReference as string || null,
          municipality_inscription: inv.municipalInscription as string || null,
          rps_series: inv.rpsSerie as string || null,
          rps_number: inv.rpsNumber as string || null,
          pdf_url: inv.pdfUrl as string || null,
          xml_url: inv.xmlUrl as string || null,
          error_message: inv.errorMessage as string || null,
          raw_payload: inv,
        }, { onConflict: conflictKey });
      return { table: `${tablePrefix}invoices`, processed: true };
    }

    case "RECEIVABLE_ANTICIPATION": {
      const a = body.anticipation as Record<string, unknown> | undefined;
      if (!a) return null;
      await supabase
        .from(`${tablePrefix}anticipations`)
        .upsert({
          company_id: companyId,
          asaas_id: a.id as string,
          status: a.status as string,
          anticipated_value: a.anticipatedValue as number || null,
          net_value: a.netValue as number || null,
          fee: a.fee as number || null,
          total_value: a.totalValue as number || null,
          installment_count: a.installmentCount as number ?? null,
          payment_id: a.payment as string || null,
          anticipation_date: a.anticipationDate as string || null,
          credit_date: a.creditDate as string || null,
          debit_date: a.debitDate as string || null,
          due_date: a.dueDate as string || null,
          denial_reason: a.denialReason as string || null,
          raw_payload: a,
        }, { onConflict: conflictKey });
      return { table: `${tablePrefix}anticipations`, processed: true };
    }

    default:
      return null;
  }
}

/** Status Asaas que representam dinheiro efetivamente recebido. */
function isPaidStatus(status: string): boolean {
  return status === "RECEIVED" || status === "CONFIRMED" || status === "RECEIVED_IN_CASH";
}

/** Escolhe um user_id da empresa p/ atribuir o lançamento automático (user_id é NOT NULL). */
async function resolveCompanyUserId(supabase: SupabaseClient, companyId: string): Promise<string | null> {
  const { data } = await supabase
    .from("company_members")
    .select("user_id, role")
    .eq("company_id", companyId);
  if (!data || data.length === 0) return null;
  const pick =
    data.find((m: Record<string, unknown>) => m.role === "owner") ||
    data.find((m: Record<string, unknown>) => m.role === "admin") ||
    data[0];
  return (pick.user_id as string) ?? null;
}

/**
 * Espelha um pagamento Asaas em `receivables` e, quando pago, cria UM lançamento
 * de receita classificado (type=revenue, status=confirmed, account/cost herdados do
 * contrato) e o linka de volta. Idempotente por external_id = asaas payment id —
 * é também a chave anti-duplicidade com o extrato do Open Finance.
 */
async function syncReceivableFromPayment(
  supabase: SupabaseClient,
  companyId: string,
  p: Record<string, unknown>,
): Promise<void> {
  const asaasPaymentId = p.id as string;
  if (!asaasPaymentId) return;
  const status = (p.status as string) || "";
  const paid = isPaidStatus(status);

  // Herda classificação/cliente do contrato pela assinatura (external_reference = contract.id).
  let contract: Record<string, unknown> | null = null;
  const subId = (p.subscription as string) || null;
  if (subId) {
    const { data } = await supabase
      .from("contracts")
      .select("id, contact_id, account_id, cost_center_id")
      .eq("company_id", companyId)
      .eq("asaas_subscription_id", subId)
      .maybeSingle();
    contract = data ?? null;
  }
  const contactId = (contract?.contact_id as string) ?? null;
  const accountId = (contract?.account_id as string) ?? null;
  const costCenterId = (contract?.cost_center_id as string) ?? null;

  const value = (p.value as number) ?? 0;
  const dueDate = (p.dueDate as string) || null;
  const description = (p.description as string) || "Cobrança Asaas";
  const boletoUrl = (p.bankSlipUrl as string) || null;
  const payUrl = (p.invoiceUrl as string) || null; // link de pagamento (boleto/pix)
  const paymentDate =
    (p.paymentDate as string) || (p.confirmedDate as string) || (p.creditDate as string) || null;
  const receivableStatus = paid ? "recebido" : status === "OVERDUE" ? "vencido" : "a_receber";

  // Upsert do receivable (dedupe por company_id + asaas_payment_id).
  const { data: existing } = await supabase
    .from("receivables")
    .select("id, transaction_id")
    .eq("company_id", companyId)
    .eq("asaas_payment_id", asaasPaymentId)
    .maybeSingle();

  let receivableId = existing?.id as string | undefined;
  let linkedTx = existing?.transaction_id as string | null | undefined;

  if (!receivableId) {
    const { data: ins } = await supabase
      .from("receivables")
      .insert({
        company_id: companyId,
        contact_id: contactId,
        contract_id: (contract?.id as string) ?? null,
        description,
        amount: value,
        due_date: dueDate,
        status: receivableStatus,
        source: "asaas",
        asaas_payment_id: asaasPaymentId,
        boleto_url: boletoUrl,
        pix_url: payUrl,
        payment_date: paid ? paymentDate : null,
        account_id: accountId,
        cost_center_id: costCenterId,
      })
      .select("id, transaction_id")
      .single();
    receivableId = ins?.id as string | undefined;
    linkedTx = ins?.transaction_id as string | null | undefined;
  } else {
    await supabase
      .from("receivables")
      .update({
        status: receivableStatus,
        boleto_url: boletoUrl,
        pix_url: payUrl,
        payment_date: paid ? paymentDate : null,
      })
      .eq("id", receivableId);
  }

  if (!paid || !receivableId || linkedTx) return; // nada a lançar / já lançado

  // Anti-duplicidade forte: se já existe lançamento com este external_id, só re-linka.
  const { data: dupTx } = await supabase
    .from("transactions")
    .select("id")
    .eq("company_id", companyId)
    .eq("external_id", asaasPaymentId)
    .eq("source", "receivable")
    .maybeSingle();
  if (dupTx?.id) {
    await supabase.from("receivables").update({ transaction_id: dupTx.id }).eq("id", receivableId);
    return;
  }

  // Sem classificação (cobrança avulsa fora de contrato) NÃO vira receita automática —
  // fica como "recebido" aguardando classificação manual, pra não poluir o DRE.
  if (!accountId || !costCenterId) return;

  const userId = await resolveCompanyUserId(supabase, companyId);
  if (!userId) return;

  const { data: tx } = await supabase
    .from("transactions")
    .insert({
      company_id: companyId,
      user_id: userId,
      date: paymentDate || dueDate,
      description,
      amount: value,
      type: "revenue",
      account_id: accountId,
      cost_center_id: costCenterId,
      status: "confirmed",
      source: "receivable",
      external_id: asaasPaymentId,
    })
    .select("id")
    .single();
  if (tx?.id) {
    await supabase.from("receivables").update({ transaction_id: tx.id }).eq("id", receivableId);
  }
}

/**
 * Maps entity data for sync operations (API bulk import).
 * Returns the mapped data object ready for upsert.
 */
export function mapTransferData(
  companyId: string,
  t: Record<string, unknown>,
): Record<string, unknown> {
  return {
    company_id: companyId,
    asaas_id: t.id as string,
    type: t.type as string || null,
    status: t.status as string,
    value: t.value as number || null,
    net_value: t.netValue as number || null,
    fee: t.fee as number || null,
    transfer_fee: t.transferFee as number || null,
    description: t.description as string || null,
    bank_account: t.bankAccount || null,
    scheduled_date: t.scheduleDate as string || t.scheduledDate as string || null,
    transaction_receipt_url: t.transactionReceiptUrl as string || null,
    authorized: t.authorized as boolean ?? null,
    operation_type: t.operationType as string || null,
    external_reference: t.externalReference as string || null,
    raw_payload: t,
  };
}

export function mapBillData(
  companyId: string,
  b: Record<string, unknown>,
): Record<string, unknown> {
  return {
    company_id: companyId,
    asaas_id: b.id as string,
    status: b.status as string,
    value: b.value as number || null,
    fee: b.fee as number || null,
    description: b.description as string || null,
    company_name: b.companyName as string || null,
    identification_field: b.identificationField as string || null,
    type: b.type as string || null,
    due_date: b.dueDate as string || null,
    schedule_date: b.scheduleDate as string || null,
    payment_date: b.paymentDate as string || null,
    can_be_cancelled: b.canBeCancelled as boolean ?? null,
    failure_reason: b.failureReason as string || null,
    raw_payload: b,
  };
}

export function mapSubscriptionData(
  companyId: string,
  s: Record<string, unknown>,
): Record<string, unknown> {
  return {
    company_id: companyId,
    asaas_id: s.id as string,
    customer_id: s.customer as string || null,
    billing_type: s.billingType as string || null,
    status: s.status as string,
    value: s.value as number || null,
    next_due_date: s.nextDueDate as string || null,
    cycle: s.cycle as string || null,
    description: s.description as string || null,
    discount: s.discount || null,
    fine: s.fine || null,
    interest: s.interest || null,
    split: s.split || null,
    max_payments: s.maxPayments as number ?? null,
    payment_count: s.paymentCount as number ?? null,
    external_reference: s.externalReference as string || null,
    end_date: s.endDate as string || null,
    raw_payload: s,
  };
}

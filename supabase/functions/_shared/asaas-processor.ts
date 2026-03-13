/**
 * Shared Asaas event processor for webhook handlers.
 * Processes events into structured tables for both PF (user_id) and PJ (company_id).
 */

// deno-lint-ignore no-explicit-any
type SupabaseClient = any;

interface ProcessResult {
  table: string;
  processed: boolean;
}

export async function processEvent(
  supabase: SupabaseClient,
  ownerKey: "user_id" | "company_id",
  ownerId: string,
  eventCategory: string,
  body: Record<string, unknown>,
): Promise<ProcessResult | null> {
  const tablePrefix = ownerKey === "company_id" ? "company_asaas_" : "asaas_";
  const conflictKey = `${ownerKey},asaas_id`;

  switch (eventCategory) {
    case "PAYMENT": {
      const p = body.payment as Record<string, unknown> | undefined;
      if (!p) return null;
      await supabase
        .from(`${tablePrefix}payments`)
        .upsert({
          [ownerKey]: ownerId,
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

      // Also materialize into personal_transactions for PF reconciliation
      if (ownerKey === "user_id" && (p.status === "RECEIVED" || p.status === "CONFIRMED")) {
        try {
          await supabase.functions.invoke("reconcile-transactions", {
            body: {
              action: "reconcile_pf",
              user_id: ownerId,
              amount: (p.netValue as number) || (p.value as number) || 0,
              date: (p.confirmedDate as string) || (p.paymentDate as string) || (p.dueDate as string) || new Date().toISOString().split("T")[0],
              type: "receita",
              description: (p.description as string) || "Pagamento Asaas",
              source: "asaas",
              external_id: `asaas_payment_${p.id}`,
              billing_type: (p.billingType as string) || null,
            },
          });
        } catch (e) {
          console.error("Reconcile PF payment error:", e);
        }
      }

      return { table: `${tablePrefix}payments`, processed: true };
    }

    case "TRANSFER": {
      const t = body.transfer as Record<string, unknown> | undefined;
      if (!t) return null;
      await supabase
        .from(`${tablePrefix}transfers`)
        .upsert({
          [ownerKey]: ownerId,
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
          [ownerKey]: ownerId,
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
          [ownerKey]: ownerId,
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
          [ownerKey]: ownerId,
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
          [ownerKey]: ownerId,
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

/**
 * Maps entity data for sync operations (API bulk import).
 * Returns the mapped data object ready for upsert.
 */
export function mapTransferData(
  ownerKey: "user_id" | "company_id",
  ownerId: string,
  t: Record<string, unknown>,
): Record<string, unknown> {
  return {
    [ownerKey]: ownerId,
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
  ownerKey: "user_id" | "company_id",
  ownerId: string,
  b: Record<string, unknown>,
): Record<string, unknown> {
  return {
    [ownerKey]: ownerId,
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
  ownerKey: "user_id" | "company_id",
  ownerId: string,
  s: Record<string, unknown>,
): Record<string, unknown> {
  return {
    [ownerKey]: ownerId,
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

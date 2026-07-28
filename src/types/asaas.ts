/**
 * Formas de assinatura, transferência e antecipação do Asaas.
 *
 * Vivem aqui, e não dentro de um hook, porque os hooks que as declaravam
 * (`useAsaasSubscriptions`, `useAsaasTransfers`) consultavam as tabelas
 * `asaas_subscriptions`, `asaas_transfers` e `asaas_anticipations`, que NÃO
 * EXISTEM mais no banco: o produto passou a ser multi-empresa e as tabelas
 * viraram `company_asaas_*`. Ninguém chamava aqueles hooks, só importava os
 * tipos deles, então a consulta quebrada nunca rodou. Ficou como armadilha:
 * quem chamasse levava 42P01 em produção, e enquanto isso derrubava o
 * type-check do repositório inteiro.
 *
 * Os hooks em uso são `useCompanyAsaasSubscriptions` e
 * `useCompanyAsaasTransfers`.
 */

export interface AsaasSubscription {
  id: string;
  asaas_id: string;
  customer_id: string | null;
  billing_type: string | null;
  status: string;
  value: number | null;
  next_due_date: string | null;
  cycle: string | null;
  description: string | null;
  max_payments: number | null;
  payment_count: number | null;
  external_reference: string | null;
  end_date: string | null;
  created_at: string;
}

/**
 * Conta bancária de destino, como o Asaas devolve: JSON solto, com o nome do
 * banco às vezes em `bank.name` e às vezes em `bankName`, dependendo da
 * origem do cadastro. Tudo opcional de propósito, porque nenhum campo é
 * garantido pela API.
 */
export interface AsaasBankAccount {
  bank?: { name?: string; code?: string } | null;
  bankName?: string | null;
  agency?: string | null;
  account?: string | null;
  accountDigit?: string | null;
  ownerName?: string | null;
}

export interface AsaasTransfer {
  id: string;
  asaas_id: string;
  type: string | null;
  status: string;
  value: number | null;
  net_value: number | null;
  fee: number | null;
  transfer_fee: number | null;
  description: string | null;
  bank_account: AsaasBankAccount | null;
  scheduled_date: string | null;
  transaction_receipt_url: string | null;
  authorized: boolean | null;
  operation_type: string | null;
  external_reference: string | null;
  created_at: string;
}

export interface AsaasAnticipation {
  id: string;
  asaas_id: string;
  status: string;
  anticipated_value: number | null;
  net_value: number | null;
  fee: number | null;
  total_value: number | null;
  installment_count: number | null;
  payment_id: string | null;
  anticipation_date: string | null;
  credit_date: string | null;
  debit_date: string | null;
  due_date: string | null;
  denial_reason: string | null;
  created_at: string;
}

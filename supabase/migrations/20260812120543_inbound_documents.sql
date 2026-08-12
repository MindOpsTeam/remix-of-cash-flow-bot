-- Notas fiscais de ENTRADA (destinadas contra o CNPJ) para conciliar compras e
-- lançar contas a pagar. Espelha o lado das vendas (invoices -> receivables).
CREATE TABLE IF NOT EXISTS public.inbound_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  tipo text NOT NULL DEFAULT 'nfe',          -- nfe | nfse
  chave_acesso text,
  numero text,
  emitente_cnpj text,
  emitente_nome text,
  valor_total numeric NOT NULL DEFAULT 0,
  data_emissao date,
  nsu text,
  manifestacao text,
  xml_content text,
  status text NOT NULL DEFAULT 'pendente',   -- pendente | lancado | ignorado
  bill_id uuid REFERENCES public.bills_payable(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS inbound_docs_company_chave_uidx
  ON public.inbound_documents(company_id, chave_acesso) WHERE chave_acesso IS NOT NULL;
CREATE INDEX IF NOT EXISTS inbound_docs_company_status_idx ON public.inbound_documents(company_id, status);
ALTER TABLE public.inbound_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members manage inbound_documents" ON public.inbound_documents FOR ALL
  USING (is_company_member(company_id)) WITH CHECK (is_company_member(company_id));
CREATE POLICY "Template nao aceita insert" ON public.inbound_documents AS RESTRICTIVE FOR INSERT WITH CHECK (NOT plataforma_bloqueada());
CREATE POLICY "Template nao aceita update" ON public.inbound_documents AS RESTRICTIVE FOR UPDATE USING (NOT plataforma_bloqueada());
CREATE POLICY "Template nao aceita delete" ON public.inbound_documents AS RESTRICTIVE FOR DELETE USING (NOT plataforma_bloqueada());
CREATE POLICY "Viewer nao insere" ON public.inbound_documents AS RESTRICTIVE FOR INSERT WITH CHECK (pode_escrever_na_empresa(company_id));
CREATE POLICY "Viewer nao altera" ON public.inbound_documents AS RESTRICTIVE FOR UPDATE USING (pode_escrever_na_empresa(company_id));
CREATE POLICY "Viewer nao apaga" ON public.inbound_documents AS RESTRICTIVE FOR DELETE USING (pode_escrever_na_empresa(company_id));

COMMENT ON TABLE public.inbound_documents IS 'Notas fiscais de entrada (destinadas contra o CNPJ) para conciliar compras e lançar contas a pagar.';

-- Baixa da conta a pagar pela conciliação de débitos.
ALTER TABLE public.bills_payable
  ADD COLUMN IF NOT EXISTS transaction_id uuid REFERENCES public.transactions(id),
  ADD COLUMN IF NOT EXISTS payment_date date;

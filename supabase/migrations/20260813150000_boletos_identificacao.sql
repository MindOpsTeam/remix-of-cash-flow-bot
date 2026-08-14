-- Boletos emitidos CONTRA a empresa em Contas a Pagar, identificados por quem cobra
-- e sem duplicar entre fontes (nota de entrada, OCR, DDA/Open Finance, manual).
--
-- Duas peças:
--   1. Identidade do boleto: linha digitável / código de barras + CNPJ do beneficiário.
--      A linha digitável é o identificador ÚNICO do boleto — permite deduplicar o
--      mesmo boleto que chega por caminhos diferentes e é o que se paga.
--   2. "Quem está cobrando": liga a conta ao fornecedor pelo CNPJ do beneficiário,
--      valendo para QUALQUER fonte (trigger central).

ALTER TABLE public.bills_payable
  ADD COLUMN IF NOT EXISTS linha_digitavel   text,
  ADD COLUMN IF NOT EXISTS codigo_barras     text,
  ADD COLUMN IF NOT EXISTS nosso_numero      text,
  ADD COLUMN IF NOT EXISTS beneficiario_cnpj text,
  ADD COLUMN IF NOT EXISTS beneficiario_nome text;

-- Dedup: um boleto (linha digitável) só entra uma vez por empresa, venha de onde vier.
CREATE UNIQUE INDEX IF NOT EXISTS bills_payable_company_linha_uidx
  ON public.bills_payable (company_id, linha_digitavel)
  WHERE linha_digitavel IS NOT NULL;

-- BEFORE INSERT central: conta de despesa padrão + identificação de quem cobra.
CREATE OR REPLACE FUNCTION public.default_account_bill()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_id   uuid;
  v_nome text;
  v_doc  text;
BEGIN
  -- Conta de despesa padrão (4.1 Custo de Mercadoria/Serviço) quando entra sem conta.
  IF NEW.account_id IS NULL THEN
    SELECT id INTO NEW.account_id
      FROM chart_of_accounts
     WHERE company_id = NEW.company_id AND type = 'expense'
     ORDER BY (code = '4.1') DESC, code
     LIMIT 1;
  END IF;

  -- Quem está cobrando: liga ao fornecedor pelo CNPJ do beneficiário quando ainda
  -- não veio um contato (cobre OCR, nota de entrada, DDA e manual de uma vez só).
  IF NEW.contact_id IS NULL AND NEW.beneficiario_cnpj IS NOT NULL THEN
    v_doc := regexp_replace(NEW.beneficiario_cnpj, '\D', '', 'g');
    IF v_doc <> '' THEN
      SELECT id, name INTO v_id, v_nome
        FROM contacts
       WHERE company_id = NEW.company_id AND document = v_doc
       LIMIT 1;
      IF v_id IS NOT NULL THEN
        NEW.contact_id := v_id;
        IF COALESCE(NEW.fornecedor, '') = '' THEN NEW.fornecedor := v_nome; END IF;
      END IF;
    END IF;
  END IF;

  -- Sem contato cadastrado, o nome do beneficiário ainda diz quem cobra.
  IF COALESCE(NEW.fornecedor, '') = '' AND NEW.beneficiario_nome IS NOT NULL THEN
    NEW.fornecedor := NEW.beneficiario_nome;
  END IF;

  RETURN NEW;
END; $$;

REVOKE EXECUTE ON FUNCTION public.default_account_bill() FROM PUBLIC, anon, authenticated;

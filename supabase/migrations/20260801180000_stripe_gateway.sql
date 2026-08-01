-- Stripe como gateway de entradas e como conciliação de repasse em lote.
--
-- Por que existe: a conciliação bancária casa 1:1 por valor exato, e por isso NUNCA
-- casa com maquininha/gateway — o crédito que cai no banco é LÍQUIDO e em LOTE
-- (N cobranças menos as taxas viram um depósito só). O Stripe expõe a composição do
-- lote, então aqui a relação N:1 deixa de ser adivinhação: o repasse traz os itens.
--
-- Doutrina contábil aplicada (mesma de _shared/contabil-br.ts):
--   receita reconhecida BRUTA na cobrança · taxa é despesa do período (4.3) ·
--   o repasse em si NÃO é resultado, é transferência entre contas da própria empresa.
--
-- Segurança: a secret key NUNCA fica em coluna nem chega ao browser. Vai pro Vault,
-- escrita por RPC com checagem de papel e lida só pelo service_role — mesmo desenho
-- de openfinance_config, e com o RBAC que faltava lá (viewer não configura gateway).

-- ── Configuração por empresa ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.stripe_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  mode text NOT NULL DEFAULT 'test' CHECK (mode IN ('test', 'live')),
  -- publishable key não é segredo (vai pro browser por definição), então fica aqui.
  publishable_key text,
  secret_key_preview text,
  webhook_configurado boolean NOT NULL DEFAULT false,
  stripe_account_id text,
  -- Para onde vão os dois lançamentos que o repasse gera:
  conta_taxa_id uuid REFERENCES public.chart_of_accounts(id) ON DELETE SET NULL,
  centro_custo_taxa_id uuid REFERENCES public.cost_centers(id) ON DELETE SET NULL,
  bank_account_id uuid REFERENCES public.bank_accounts(id) ON DELETE SET NULL,
  active boolean NOT NULL DEFAULT true,
  last_test_at timestamptz,
  last_test_status text,
  last_sync_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id)
);

-- ── Cobranças (o lado N) ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.stripe_charges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  stripe_id text NOT NULL,                       -- ch_... ou pi_...
  balance_transaction_id text,                   -- txn_..., é ele que liga ao repasse
  payout_id text,
  status text,
  -- Valores em CENTAVOS, como o Stripe entrega. Converter cedo estraga a soma
  -- que precisa fechar exata contra o repasse.
  amount_bruto integer NOT NULL DEFAULT 0,
  amount_taxa integer NOT NULL DEFAULT 0,
  amount_liquido integer NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'brl',
  description text,
  customer_email text,
  paid_at timestamptz,
  receivable_id uuid REFERENCES public.receivables(id) ON DELETE SET NULL,
  transaction_id uuid REFERENCES public.transactions(id) ON DELETE SET NULL,
  raw jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, stripe_id)
);

CREATE INDEX IF NOT EXISTS idx_stripe_charges_payout ON public.stripe_charges (company_id, payout_id);

-- ── Repasses (o lado 1) ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.stripe_payouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  stripe_id text NOT NULL,                       -- po_...
  status text,
  amount_liquido integer NOT NULL DEFAULT 0,     -- o que o Stripe diz que depositou
  amount_bruto integer NOT NULL DEFAULT 0,       -- somado dos itens
  amount_taxa integer NOT NULL DEFAULT 0,        -- somado dos itens
  itens integer NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'brl',
  arrival_date date,
  -- Fecha ou não fecha: se a soma dos itens não reproduz o líquido, a conciliação
  -- para. Guardar a diferença é o que permite explicar o porquê na tela.
  composicao_fecha boolean NOT NULL DEFAULT false,
  diferenca integer NOT NULL DEFAULT 0,
  -- Resultado da conciliação contra o extrato. O crédito do repasse fica em
  -- bank_raw_id porque ele NÃO vira lançamento: a receita já foi reconhecida
  -- bruta em cada cobrança, então transformar o depósito em receita faturaria
  -- o mesmo dinheiro duas vezes. bank_transaction_id só é usado quando a linha
  -- já havia sido importada antes — caso em que a tela reporta a duplicidade.
  bank_raw_id uuid REFERENCES public.bank_transactions_raw(id) ON DELETE SET NULL,
  bank_transaction_id uuid REFERENCES public.transactions(id) ON DELETE SET NULL,
  taxa_transaction_id uuid REFERENCES public.transactions(id) ON DELETE SET NULL,
  conciliado_em timestamptz,
  raw jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, stripe_id)
);

-- ── Idempotência do webhook ────────────────────────────────────────────────────
-- O Stripe reenvia evento até receber 2xx. Sem esta trava, um reenvio lança a
-- mesma receita de novo.
CREATE TABLE IF NOT EXISTS public.stripe_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
  stripe_event_id text NOT NULL UNIQUE,
  type text,
  processed_at timestamptz NOT NULL DEFAULT now(),
  erro text,
  raw jsonb
);

-- ── Colunas no título ──────────────────────────────────────────────────────────
ALTER TABLE public.receivables ADD COLUMN IF NOT EXISTS stripe_payment_intent_id text;
ALTER TABLE public.receivables ADD COLUMN IF NOT EXISTS stripe_checkout_url text;
CREATE INDEX IF NOT EXISTS idx_receivables_stripe_pi
  ON public.receivables (company_id, stripe_payment_intent_id)
  WHERE stripe_payment_intent_id IS NOT NULL;

-- ── RLS ────────────────────────────────────────────────────────────────────────
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['stripe_config', 'stripe_charges', 'stripe_payouts', 'stripe_events'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);

    EXECUTE format('DROP POLICY IF EXISTS "Membros veem" ON public.%I', t);
    EXECUTE format(
      'CREATE POLICY "Membros veem" ON public.%I FOR SELECT TO authenticated USING (public.is_company_member(company_id))', t);

    EXECUTE format('DROP POLICY IF EXISTS "Membros inserem" ON public.%I', t);
    EXECUTE format(
      'CREATE POLICY "Membros inserem" ON public.%I FOR INSERT TO authenticated WITH CHECK (public.is_company_member(company_id))', t);

    EXECUTE format('DROP POLICY IF EXISTS "Membros alteram" ON public.%I', t);
    EXECUTE format(
      'CREATE POLICY "Membros alteram" ON public.%I FOR UPDATE TO authenticated USING (public.is_company_member(company_id)) WITH CHECK (public.is_company_member(company_id))', t);

    EXECUTE format('DROP POLICY IF EXISTS "Membros apagam" ON public.%I', t);
    EXECUTE format(
      'CREATE POLICY "Membros apagam" ON public.%I FOR DELETE TO authenticated USING (public.is_company_member(company_id))', t);

    -- RESTRICTIVE: papel viewer não escreve (RBAC real, não só a UI).
    EXECUTE format('DROP POLICY IF EXISTS "Viewer nao insere" ON public.%I', t);
    EXECUTE format(
      'CREATE POLICY "Viewer nao insere" ON public.%I AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK (public.pode_escrever_na_empresa(company_id))', t);
    EXECUTE format('DROP POLICY IF EXISTS "Viewer nao altera" ON public.%I', t);
    EXECUTE format(
      'CREATE POLICY "Viewer nao altera" ON public.%I AS RESTRICTIVE FOR UPDATE TO authenticated USING (public.pode_escrever_na_empresa(company_id))', t);
    EXECUTE format('DROP POLICY IF EXISTS "Viewer nao apaga" ON public.%I', t);
    EXECUTE format(
      'CREATE POLICY "Viewer nao apaga" ON public.%I AS RESTRICTIVE FOR DELETE TO authenticated USING (public.pode_escrever_na_empresa(company_id))', t);

    -- RESTRICTIVE: o banco original é template travado; o remix libera sozinho.
    EXECUTE format('DROP POLICY IF EXISTS "Template nao aceita insert" ON public.%I', t);
    EXECUTE format(
      'CREATE POLICY "Template nao aceita insert" ON public.%I AS RESTRICTIVE FOR INSERT WITH CHECK (NOT public.plataforma_bloqueada())', t);
    EXECUTE format('DROP POLICY IF EXISTS "Template nao aceita update" ON public.%I', t);
    EXECUTE format(
      'CREATE POLICY "Template nao aceita update" ON public.%I AS RESTRICTIVE FOR UPDATE USING (NOT public.plataforma_bloqueada())', t);
    EXECUTE format('DROP POLICY IF EXISTS "Template nao aceita delete" ON public.%I', t);
    EXECUTE format(
      'CREATE POLICY "Template nao aceita delete" ON public.%I AS RESTRICTIVE FOR DELETE USING (NOT public.plataforma_bloqueada())', t);

    EXECUTE format('DROP TRIGGER IF EXISTS set_updated_at_%s ON public.%I', t, t);
  END LOOP;
END $$;

CREATE TRIGGER set_updated_at_stripe_config BEFORE UPDATE ON public.stripe_config
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER set_updated_at_stripe_charges BEFORE UPDATE ON public.stripe_charges
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER set_updated_at_stripe_payouts BEFORE UPDATE ON public.stripe_payouts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ── Credenciais no Vault ───────────────────────────────────────────────────────
-- Escrita pela tela. Passar vazio apaga. Diferente de set_pluggy_credentials, aqui
-- a checagem é pode_escrever_na_empresa: configurar meio de recebimento é ato de
-- administração, não de leitura.
CREATE OR REPLACE FUNCTION public.set_stripe_credentials(
  p_company_id uuid,
  p_secret_key text,
  p_webhook_secret text DEFAULT NULL,
  p_publishable_key text DEFAULT NULL,
  p_mode text DEFAULT 'test'
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_nome_secret text; v_nome_webhook text; v_id uuid; v_preview text;
BEGIN
  IF NOT public.pode_escrever_na_empresa(p_company_id) THEN
    RAISE EXCEPTION 'Sem permissão para configurar o gateway desta empresa';
  END IF;
  IF p_mode NOT IN ('test', 'live') THEN
    RAISE EXCEPTION 'Modo inválido: use test ou live';
  END IF;

  v_nome_secret := 'stripe_secret_key_' || p_company_id::text;
  v_nome_webhook := 'stripe_webhook_secret_' || p_company_id::text;

  IF p_secret_key IS NULL OR length(trim(p_secret_key)) = 0 THEN
    DELETE FROM vault.secrets WHERE name IN (v_nome_secret, v_nome_webhook);
    v_preview := NULL;
  ELSE
    IF trim(p_secret_key) NOT LIKE 'sk_%' AND trim(p_secret_key) NOT LIKE 'rk_%' THEN
      RAISE EXCEPTION 'Chave secreta do Stripe começa com sk_ ou rk_';
    END IF;
    -- Erro caro e silencioso: colar a publishable no campo da secret. Barra aqui.
    IF trim(p_secret_key) LIKE 'pk_%' THEN
      RAISE EXCEPTION 'Essa é a chave publicável (pk_), não a secreta';
    END IF;

    SELECT id INTO v_id FROM vault.secrets WHERE name = v_nome_secret;
    IF v_id IS NULL THEN PERFORM vault.create_secret(trim(p_secret_key), v_nome_secret, 'Stripe Secret Key');
    ELSE PERFORM vault.update_secret(v_id, trim(p_secret_key)); END IF;

    IF p_webhook_secret IS NOT NULL AND length(trim(p_webhook_secret)) > 0 THEN
      v_id := NULL;
      SELECT id INTO v_id FROM vault.secrets WHERE name = v_nome_webhook;
      IF v_id IS NULL THEN PERFORM vault.create_secret(trim(p_webhook_secret), v_nome_webhook, 'Stripe Webhook Secret');
      ELSE PERFORM vault.update_secret(v_id, trim(p_webhook_secret)); END IF;
    END IF;

    -- Só os últimos 4: o suficiente para conferir contra o dashboard, insuficiente
    -- para usar. Prefixo revelaria o modo, que já está em coluna própria.
    v_preview := '••••' || right(trim(p_secret_key), 4);
  END IF;

  INSERT INTO public.stripe_config (company_id, mode) VALUES (p_company_id, p_mode)
  ON CONFLICT (company_id) DO NOTHING;

  UPDATE public.stripe_config
     SET secret_key_preview = v_preview,
         mode = p_mode,
         publishable_key = COALESCE(NULLIF(trim(p_publishable_key), ''), publishable_key),
         webhook_configurado = (p_webhook_secret IS NOT NULL AND length(trim(p_webhook_secret)) > 0)
                                OR (v_preview IS NOT NULL AND webhook_configurado)
   WHERE company_id = p_company_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.set_stripe_credentials(uuid, text, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_stripe_credentials(uuid, text, text, text, text) TO authenticated;

-- Leitura: só as edge functions. authenticated NÃO recebe grant — é o que impede
-- qualquer usuário logado de puxar a chave da empresa por RPC.
CREATE OR REPLACE FUNCTION public.get_stripe_credentials(p_company_id uuid)
RETURNS json
LANGUAGE sql SECURITY DEFINER SET search_path = public
AS $$
  SELECT json_build_object(
    'secret_key', (SELECT decrypted_secret FROM vault.decrypted_secrets
                    WHERE name = 'stripe_secret_key_' || p_company_id::text LIMIT 1),
    'webhook_secret', (SELECT decrypted_secret FROM vault.decrypted_secrets
                        WHERE name = 'stripe_webhook_secret_' || p_company_id::text LIMIT 1)
  );
$$;

REVOKE EXECUTE ON FUNCTION public.get_stripe_credentials(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_stripe_credentials(uuid) TO service_role;

-- ── Visão do repasse para a tela ───────────────────────────────────────────────
-- A tela precisa mostrar o lote inteiro sem N chamadas. security_invoker mantém a
-- RLS do usuário valendo dentro da view.
DROP VIEW IF EXISTS public.v_stripe_repasses;
CREATE VIEW public.v_stripe_repasses
WITH (security_invoker = true) AS
SELECT
  p.id,
  p.company_id,
  p.stripe_id,
  p.status,
  p.arrival_date,
  p.itens,
  p.amount_bruto,
  p.amount_taxa,
  p.amount_liquido,
  p.composicao_fecha,
  p.diferenca,
  p.conciliado_em,
  p.bank_transaction_id,
  p.taxa_transaction_id,
  p.bank_raw_id,
  (p.bank_raw_id IS NOT NULL OR p.bank_transaction_id IS NOT NULL) AS creditado_no_extrato,
  (SELECT count(*) FROM public.stripe_charges c
    WHERE c.company_id = p.company_id AND c.payout_id = p.stripe_id) AS cobrancas_ligadas
FROM public.stripe_payouts p;

COMMENT ON TABLE public.stripe_payouts IS
  'Repasse do gateway: crédito LÍQUIDO e em LOTE. Não é receita — é transferência entre contas próprias. A receita já foi reconhecida bruta em cada cobrança.';
COMMENT ON COLUMN public.stripe_payouts.diferenca IS
  'Líquido informado menos a soma dos itens, em centavos. Diferente de zero significa item faltando: a conciliação para em vez de chutar.';

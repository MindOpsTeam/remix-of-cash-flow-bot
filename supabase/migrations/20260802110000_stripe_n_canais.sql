-- Stripe: N canais por empresa.
--
-- Antes: `stripe_config_company_id_key` limitava cada empresa a UMA conta Stripe.
-- O caso real que quebra isso é comum: a empresa A tem dois canais de entrada
-- (loja física e checkout do site) e a empresa B tem três. Com um só, o segundo
-- canal sobrescrevia o primeiro — inclusive a chave no cofre, que era nomeada
-- pela empresa.
--
-- Depois: a unidade de configuração passa a ser o CANAL, e a empresa continua
-- sendo a fronteira de isolamento. Identidade do canal = (empresa, apelido),
-- porque é pelo apelido que o operador distingue "Loja SP" de "Checkout site"
-- na tela, no repasse e no relatório. A unicidade NÃO é por company_id sozinho,
-- de propósito: esse é justamente o formato que limitava a um canal.
--
-- Cofre: os segredos passam de `stripe_secret_key_<company_id>` para
-- `stripe_secret_key_<config_id>`. A migração COPIA para o nome novo antes de
-- apagar o antigo, no mesmo statement — se algo falhar no meio, a transação
-- inteira volta e nenhuma chave se perde.

-- ── 1. Apelido do canal ────────────────────────────────────────────────────
ALTER TABLE public.stripe_config
  ADD COLUMN IF NOT EXISTS apelido text NOT NULL DEFAULT 'Principal';

-- ── 2. A unicidade passa a ser por canal ───────────────────────────────────
ALTER TABLE public.stripe_config DROP CONSTRAINT IF EXISTS stripe_config_company_id_key;
ALTER TABLE public.stripe_config DROP CONSTRAINT IF EXISTS stripe_config_company_id_apelido_key;
ALTER TABLE public.stripe_config
  ADD CONSTRAINT stripe_config_company_id_apelido_key UNIQUE (company_id, apelido);

-- ── 3. Cobrança e repasse sabem de qual canal vieram ───────────────────────
-- Sem isto, dois canais na mesma empresa viram um caldo só: a conciliação N:1
-- tentaria compor um lote do canal A com cobranças do canal B.
ALTER TABLE public.stripe_charges
  ADD COLUMN IF NOT EXISTS config_id uuid REFERENCES public.stripe_config(id) ON DELETE SET NULL;
ALTER TABLE public.stripe_payouts
  ADD COLUMN IF NOT EXISTS config_id uuid REFERENCES public.stripe_config(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_stripe_charges_config ON public.stripe_charges (company_id, config_id);
CREATE INDEX IF NOT EXISTS idx_stripe_payouts_config ON public.stripe_payouts (company_id, config_id);

-- Backfill: quem já existe pertence ao único canal que a empresa tinha.
UPDATE public.stripe_charges c SET config_id = k.id
  FROM public.stripe_config k WHERE k.company_id = c.company_id AND c.config_id IS NULL;
UPDATE public.stripe_payouts p SET config_id = k.id
  FROM public.stripe_config k WHERE k.company_id = p.company_id AND p.config_id IS NULL;

-- Os ids do Stripe são únicos por CONTA, não globalmente: duas contas podem, em
-- tese, ter cobranças de mesmo id. A unicidade acompanha o canal.
ALTER TABLE public.stripe_charges DROP CONSTRAINT IF EXISTS stripe_charges_company_id_stripe_id_key;
ALTER TABLE public.stripe_charges DROP CONSTRAINT IF EXISTS stripe_charges_config_id_stripe_id_key;
CREATE UNIQUE INDEX IF NOT EXISTS stripe_charges_config_id_stripe_id_key
  ON public.stripe_charges (config_id, stripe_id);
ALTER TABLE public.stripe_payouts DROP CONSTRAINT IF EXISTS stripe_payouts_company_id_stripe_id_key;
CREATE UNIQUE INDEX IF NOT EXISTS stripe_payouts_config_id_stripe_id_key
  ON public.stripe_payouts (config_id, stripe_id);

-- ── 4. Cofre por canal ─────────────────────────────────────────────────────
DO $$
DECLARE k record; v_antigo uuid; v_valor text;
BEGIN
  FOR k IN SELECT id, company_id FROM public.stripe_config LOOP
    -- Secret key
    SELECT id, decrypted_secret INTO v_antigo, v_valor FROM vault.decrypted_secrets
     WHERE name = 'stripe_secret_key_' || k.company_id::text LIMIT 1;
    IF v_antigo IS NOT NULL THEN
      IF NOT EXISTS (SELECT 1 FROM vault.secrets WHERE name = 'stripe_secret_key_' || k.id::text) THEN
        PERFORM vault.create_secret(v_valor, 'stripe_secret_key_' || k.id::text, 'Stripe Secret Key (canal)');
      END IF;
      DELETE FROM vault.secrets WHERE id = v_antigo;
    END IF;

    -- Webhook secret
    v_antigo := NULL;
    SELECT id, decrypted_secret INTO v_antigo, v_valor FROM vault.decrypted_secrets
     WHERE name = 'stripe_webhook_secret_' || k.company_id::text LIMIT 1;
    IF v_antigo IS NOT NULL THEN
      IF NOT EXISTS (SELECT 1 FROM vault.secrets WHERE name = 'stripe_webhook_secret_' || k.id::text) THEN
        PERFORM vault.create_secret(v_valor, 'stripe_webhook_secret_' || k.id::text, 'Stripe Webhook Secret (canal)');
      END IF;
      DELETE FROM vault.secrets WHERE id = v_antigo;
    END IF;
  END LOOP;
END $$;

-- ── 5. RPCs por canal ──────────────────────────────────────────────────────
DROP FUNCTION IF EXISTS public.set_stripe_credentials(uuid, text, text, text, text);
DROP FUNCTION IF EXISTS public.get_stripe_credentials(uuid);

/**
 * Cria ou atualiza um CANAL e guarda as chaves dele no cofre.
 *
 * Devolve o id do canal, que é o que a tela precisa para editar depois e o que
 * o webhook precisa para saber contra qual segredo conferir a assinatura.
 */
CREATE OR REPLACE FUNCTION public.set_stripe_credentials(
  p_company_id uuid,
  p_secret_key text,
  p_webhook_secret text DEFAULT NULL,
  p_publishable_key text DEFAULT NULL,
  p_mode text DEFAULT 'test',
  p_apelido text DEFAULT 'Principal'
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $fn$
DECLARE
  v_config_id uuid; v_id uuid; v_preview text; v_apelido text;
BEGIN
  IF NOT public.pode_escrever_na_empresa(p_company_id) THEN
    RAISE EXCEPTION 'Sem permissão para configurar o gateway desta empresa';
  END IF;
  IF p_mode NOT IN ('test', 'live') THEN
    RAISE EXCEPTION 'Modo inválido: use test ou live';
  END IF;

  v_apelido := coalesce(nullif(trim(p_apelido), ''), 'Principal');

  INSERT INTO public.stripe_config (company_id, apelido, mode)
  VALUES (p_company_id, v_apelido, p_mode)
  ON CONFLICT (company_id, apelido) DO UPDATE SET mode = EXCLUDED.mode
  RETURNING id INTO v_config_id;

  IF p_secret_key IS NULL OR length(trim(p_secret_key)) = 0 THEN
    DELETE FROM vault.secrets
     WHERE name IN ('stripe_secret_key_' || v_config_id::text,
                    'stripe_webhook_secret_' || v_config_id::text);
    v_preview := NULL;
  ELSE
    IF trim(p_secret_key) LIKE 'pk_%' THEN
      RAISE EXCEPTION 'Essa é a chave publicável (pk_), não a secreta';
    END IF;
    IF trim(p_secret_key) NOT LIKE 'sk_%' AND trim(p_secret_key) NOT LIKE 'rk_%' THEN
      RAISE EXCEPTION 'Chave secreta do Stripe começa com sk_ ou rk_';
    END IF;

    SELECT id INTO v_id FROM vault.secrets WHERE name = 'stripe_secret_key_' || v_config_id::text;
    IF v_id IS NULL THEN
      PERFORM vault.create_secret(trim(p_secret_key), 'stripe_secret_key_' || v_config_id::text, 'Stripe Secret Key');
    ELSE PERFORM vault.update_secret(v_id, trim(p_secret_key)); END IF;

    IF p_webhook_secret IS NOT NULL AND length(trim(p_webhook_secret)) > 0 THEN
      v_id := NULL;
      SELECT id INTO v_id FROM vault.secrets WHERE name = 'stripe_webhook_secret_' || v_config_id::text;
      IF v_id IS NULL THEN
        PERFORM vault.create_secret(trim(p_webhook_secret), 'stripe_webhook_secret_' || v_config_id::text, 'Stripe Webhook Secret');
      ELSE PERFORM vault.update_secret(v_id, trim(p_webhook_secret)); END IF;
    END IF;

    v_preview := '••••' || right(trim(p_secret_key), 4);
  END IF;

  UPDATE public.stripe_config
     SET secret_key_preview = v_preview,
         mode = p_mode,
         publishable_key = COALESCE(NULLIF(trim(p_publishable_key), ''), publishable_key),
         webhook_configurado = (p_webhook_secret IS NOT NULL AND length(trim(p_webhook_secret)) > 0)
                                OR (v_preview IS NOT NULL AND webhook_configurado)
   WHERE id = v_config_id;

  RETURN v_config_id;
END;
$fn$;

REVOKE EXECUTE ON FUNCTION public.set_stripe_credentials(uuid, text, text, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_stripe_credentials(uuid, text, text, text, text, text) TO authenticated;

/** Chaves de UM canal. Só o service_role lê. */
CREATE OR REPLACE FUNCTION public.get_stripe_credentials(p_config_id uuid)
RETURNS json
LANGUAGE sql SECURITY DEFINER SET search_path = public
AS $fn$
  SELECT json_build_object(
    'config_id', p_config_id,
    'company_id', (SELECT company_id FROM public.stripe_config WHERE id = p_config_id),
    'secret_key', (SELECT decrypted_secret FROM vault.decrypted_secrets
                    WHERE name = 'stripe_secret_key_' || p_config_id::text LIMIT 1),
    'webhook_secret', (SELECT decrypted_secret FROM vault.decrypted_secrets
                        WHERE name = 'stripe_webhook_secret_' || p_config_id::text LIMIT 1)
  );
$fn$;

REVOKE EXECUTE ON FUNCTION public.get_stripe_credentials(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_stripe_credentials(uuid) TO service_role;

/**
 * Compatibilidade: resolve a empresa para o canal ÚNICO dela.
 *
 * Existe para os webhooks já cadastrados no dashboard do Stripe com `?company=`
 * não pararem no dia do deploy. Devolve nulo quando há mais de um canal — aí a
 * empresa é ambígua e o endereço precisa mesmo ser atualizado para o canal.
 */
CREATE OR REPLACE FUNCTION public.resolver_canal_stripe_unico(p_company_id uuid)
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $fn$
  SELECT id FROM public.stripe_config
   WHERE company_id = p_company_id
     AND (SELECT count(*) FROM public.stripe_config WHERE company_id = p_company_id) = 1
   LIMIT 1;
$fn$;

REVOKE EXECUTE ON FUNCTION public.resolver_canal_stripe_unico(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.resolver_canal_stripe_unico(uuid) TO service_role;

COMMENT ON COLUMN public.stripe_config.apelido IS
  'Como o operador chama este canal ("Loja SP", "Checkout site"). É a identidade do canal dentro da empresa e aparece no repasse e na cobrança.';

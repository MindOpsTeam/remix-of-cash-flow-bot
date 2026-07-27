-- Limpeza do que a varredura lógica apontou como grave (docs/plataforma-modelo.json).
--
-- 1) PREFERÊNCIAS QUE NÃO PERSISTIAM
-- A tela de Preferências guardava tudo em localStorage: trocar de navegador
-- zerava a configuração. Ganha uma coluna jsonb e passa a viver na conta.
ALTER TABLE public.user_preferences
  ADD COLUMN IF NOT EXISTS prefs jsonb NOT NULL DEFAULT '{}'::jsonb;

-- 2) A PONTE SÓCIO ↔ EMPRESA TINHA UMA PERNA SÓ
-- owner_transactions modelava os dois lados (PF e PJ), mas a tela sempre gravou
-- pf_account_id = null e o módulo de finanças pessoais não existe mais no
-- produto. Das 2 linhas em produção, zero tinham qualquer valor de PF.
-- As policies precisam ser recriadas ANTES, porque referenciam a coluna.
DROP POLICY IF EXISTS "Users can insert own owner transactions" ON public.owner_transactions;
CREATE POLICY "Users can insert own owner transactions"
ON public.owner_transactions FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND public.is_company_member(company_id)
  AND (pj_bank_account_id IS NULL OR EXISTS (
    SELECT 1 FROM public.bank_accounts ba
    WHERE ba.id = owner_transactions.pj_bank_account_id
      AND ba.company_id = owner_transactions.company_id))
);

DROP POLICY IF EXISTS "Users can update own owner transactions" ON public.owner_transactions;
CREATE POLICY "Users can update own owner transactions"
ON public.owner_transactions FOR UPDATE TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (
  auth.uid() = user_id
  AND public.is_company_member(company_id)
  AND (pj_bank_account_id IS NULL OR EXISTS (
    SELECT 1 FROM public.bank_accounts ba
    WHERE ba.id = owner_transactions.pj_bank_account_id
      AND ba.company_id = owner_transactions.company_id))
);

ALTER TABLE public.owner_transactions DROP COLUMN IF EXISTS pf_account_id;
ALTER TABLE public.owner_transactions DROP COLUMN IF EXISTS pf_transaction_id;

-- 3) DUAS FAMÍLIAS MORTAS OCUPANDO O SCHEMA
-- personal_* (14 tabelas, módulo de finanças pessoais retirado do produto,
-- última movimentação em 13/03) + journal_entries (o razão daquele módulo) e
-- asaas_* (8 tabelas por usuário, substituídas pelas company_asaas_* por
-- empresa; a edge function que as alimentava foi deletada em julho).
-- Nenhuma linha de código, nenhuma edge function viva e nenhuma FK externa
-- apontavam para elas.
--
-- Em produção o conteúdo foi COPIADO para o schema backup_20260727 antes do
-- drop, com contagem conferida linha a linha (personal_transactions 14=14,
-- personal_categories 14=14, journal_entries 14=14, asaas_webhook_events 16=16,
-- asaas_payments 3=3).
DO $$
DECLARE t text;
BEGIN
  FOR t IN
    SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind = 'r'
      AND (c.relname LIKE 'personal\_%' OR c.relname LIKE 'asaas\_%' OR c.relname = 'journal_entries')
  LOOP
    EXECUTE format('DROP TABLE IF EXISTS public.%I CASCADE', t);
  END LOOP;
END $$;

-- 4) FILA DE AÇÕES DO WHATSAPP QUE NINGUÉM CONSOME
-- Vazia, sem referência em código e substituída por agent_actions, que a tela
-- /agents usa de verdade.
DROP TABLE IF EXISTS public.whatsapp_pending_actions;

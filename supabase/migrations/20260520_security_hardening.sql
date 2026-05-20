-- Security hardening — pós-auditoria 2026-05-20
-- Fixes para P0 #2 (webhook secret), P1 #4 (nfse_config RLS) e P1 #8 (self-INSERT company_members)

-- ============================================================
-- P0 #2: whatsapp_configs.webhook_secret
-- ============================================================
ALTER TABLE public.whatsapp_configs
  ADD COLUMN IF NOT EXISTS webhook_secret TEXT;

-- Backfill: cada config existente ganha um secret único
UPDATE public.whatsapp_configs
SET webhook_secret = gen_random_uuid()::text
WHERE webhook_secret IS NULL;

-- Novos inserts geram automaticamente
ALTER TABLE public.whatsapp_configs
  ALTER COLUMN webhook_secret SET DEFAULT gen_random_uuid()::text;

ALTER TABLE public.whatsapp_configs
  ALTER COLUMN webhook_secret SET NOT NULL;


-- ============================================================
-- P1 #4: nfse_config — recriar policies com is_company_member
-- ============================================================
-- Drop policies legacy que referenciavam companies.user_id (coluna inexistente).
DROP POLICY IF EXISTS "Users can view their company nfse_config"   ON public.nfse_config;
DROP POLICY IF EXISTS "Users can insert their company nfse_config" ON public.nfse_config;
DROP POLICY IF EXISTS "Users can update their company nfse_config" ON public.nfse_config;
DROP POLICY IF EXISTS "Users can delete their company nfse_config" ON public.nfse_config;

DO $$ BEGIN
  CREATE POLICY "cm_nfse_config_select" ON public.nfse_config
    FOR SELECT TO authenticated
    USING (public.is_company_member(company_id));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "cm_nfse_config_insert" ON public.nfse_config
    FOR INSERT TO authenticated
    WITH CHECK (public.is_company_member(company_id));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "cm_nfse_config_update" ON public.nfse_config
    FOR UPDATE TO authenticated
    USING (public.is_company_member(company_id))
    WITH CHECK (public.is_company_member(company_id));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "cm_nfse_config_delete" ON public.nfse_config
    FOR DELETE TO authenticated
    USING (public.is_company_member(company_id));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;


-- ============================================================
-- P1 #8: company_members — fechar self-INSERT com role livre
-- ============================================================
-- Exploit anterior: qualquer authenticated podia rodar
--   INSERT INTO company_members(company_id, user_id, role)
--   VALUES ('<alvo>', auth.uid(), 'admin');
-- e ganhar admin em qualquer empresa cujo UUID conhecesse.
--
-- Solução:
-- 1. DROP da policy permissiva
-- 2. INSERT direto fica BLOQUEADO. `create_company_for_user` continua funcionando
--    porque é SECURITY DEFINER (bypassa RLS).
-- 3. Adicionamos UPDATE self-only para o frontend conseguir gravar
--    `onboarding_completed` sem virar vetor de escalada (não permite mudar role/
--    user_id/company_id em nenhuma chamada).
DROP POLICY IF EXISTS "Users can add themselves to companies" ON public.company_members;

DO $$ BEGIN
  CREATE POLICY "cm_self_update_nonprivileged" ON public.company_members
    FOR UPDATE TO authenticated
    USING (user_id = auth.uid())
    WITH CHECK (
      user_id = auth.uid()
      AND user_id = (SELECT user_id FROM public.company_members cm WHERE cm.id = company_members.id)
      AND company_id = (SELECT company_id FROM public.company_members cm WHERE cm.id = company_members.id)
      AND role = (SELECT role FROM public.company_members cm WHERE cm.id = company_members.id)
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Garantir que role seja restrita ao conjunto válido (defesa em profundidade).
DO $$ BEGIN
  ALTER TABLE public.company_members
    ADD CONSTRAINT company_members_role_check
    CHECK (role IN ('admin', 'member', 'viewer'));
EXCEPTION WHEN duplicate_object THEN NULL;
         WHEN check_violation THEN NULL;
END $$;

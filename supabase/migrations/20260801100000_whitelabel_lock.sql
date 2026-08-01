-- Template whitelabel: o banco de ORIGEM é somente leitura; o remix nasce livre.
--
-- Mecanismo: `system_identifier` do cluster Postgres (pg_control_system()) é único
-- por instalação. Guardamos o identificador DESTE banco em platform_lock; a trava
-- vale se, e somente se, o cluster atual for aquele. Quando alguém remixa o projeto
-- no Lovable, o Supabase provisionado é OUTRO cluster → a condição é falsa e tudo
-- libera SOZINHO, sem ninguém rodar nada.
--
-- A função falha para o lado seguro de propósito: sem tabela, sem linha ou em outro
-- cluster, o resultado é "não bloqueado". Um remix jamais nasce travado.
--
-- Válvula de destravamento do original (para o dono do template):
--   DELETE FROM public.platform_lock;

CREATE TABLE IF NOT EXISTS public.platform_lock (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  locked_system_identifier text NOT NULL,
  motivo text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.platform_lock ENABLE ROW LEVEL SECURITY;

-- Qualquer um pode LER (o app precisa saber que está em modo template);
-- ninguém autenticado escreve: só service_role / SQL direto.
DROP POLICY IF EXISTS "Todos leem o estado da trava" ON public.platform_lock;
CREATE POLICY "Todos leem o estado da trava" ON public.platform_lock FOR SELECT USING (true);

-- Grava o identificador DESTE cluster como o banco travado.
INSERT INTO public.platform_lock (id, locked_system_identifier, motivo)
VALUES (
  true,
  (SELECT system_identifier::text FROM pg_control_system()),
  'Projeto original whitelabel: leitura apenas. Um remix roda em outro cluster e é liberado automaticamente.'
)
ON CONFLICT (id) DO UPDATE
  SET locked_system_identifier = EXCLUDED.locked_system_identifier,
      motivo = EXCLUDED.motivo;

/**
 * Estamos no banco de origem travado?
 * STABLE (uma avaliação por statement) para não pesar em policy de linha.
 */
CREATE OR REPLACE FUNCTION public.plataforma_bloqueada()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.platform_lock l
    WHERE l.locked_system_identifier = (SELECT system_identifier::text FROM pg_control_system())
  );
$function$;

GRANT EXECUTE ON FUNCTION public.plataforma_bloqueada() TO anon, authenticated;

-- ── Escrita bloqueada em TODAS as tabelas de dados ─────────────────────────
-- RESTRICTIVE se soma às policies existentes: escrever exige passar nas duas.
-- No remix, plataforma_bloqueada() = false e estas policies viram no-op.
DO $$
DECLARE
  t record;
  -- platform_lock fica de fora: é o próprio interruptor.
  v_pular text[] := ARRAY['platform_lock'];
BEGIN
  FOR t IN
    SELECT c.relname
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind = 'r'
      AND c.relrowsecurity          -- só onde RLS já está ligado
      AND NOT (c.relname = ANY (v_pular))
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'Template nao aceita insert', t.relname);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I AS RESTRICTIVE FOR INSERT WITH CHECK (NOT public.plataforma_bloqueada())',
      'Template nao aceita insert', t.relname);

    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'Template nao aceita update', t.relname);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I AS RESTRICTIVE FOR UPDATE USING (NOT public.plataforma_bloqueada())',
      'Template nao aceita update', t.relname);

    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'Template nao aceita delete', t.relname);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I AS RESTRICTIVE FOR DELETE USING (NOT public.plataforma_bloqueada())',
      'Template nao aceita delete', t.relname);
  END LOOP;
END $$;

-- ── Cadastro bloqueado ─────────────────────────────────────────────────────
-- O GoTrue insere em auth.users; barrar aqui mata o signup na raiz. Só INSERT:
-- login e atualização de sessão seguem livres (mesmo cuidado de protege_conta_demo).
CREATE OR REPLACE FUNCTION public.bloqueia_cadastro_no_template()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF public.plataforma_bloqueada() THEN
    RAISE EXCEPTION 'Este é o projeto original (somente leitura). Remixe o projeto para ter o seu próprio ambiente com cadastro liberado.'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_bloqueia_cadastro_no_template ON auth.users;
CREATE TRIGGER trg_bloqueia_cadastro_no_template
  BEFORE INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.bloqueia_cadastro_no_template();

-- ── Guard nas RPCs que criam dado do zero ──────────────────────────────────
-- SECURITY DEFINER bypassa RLS, então as policies acima não as alcançam.
CREATE OR REPLACE FUNCTION public.create_company_for_user(company_name text, company_cnpj text DEFAULT NULL::text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  new_company_id uuid;
  n_companies int;
  clean_cnpj text;
  result json;
begin
  if public.plataforma_bloqueada() then
    raise exception 'Este é o projeto original (somente leitura). Remixe para criar empresas.' using errcode = '42501';
  end if;
  if public.is_demo_account() then
    raise exception 'A conta de demonstração não pode criar empresas.' using errcode = '42501';
  end if;

  select count(*) into n_companies from company_members where user_id = auth.uid();
  if n_companies >= 6 then
    raise exception 'Limite de 6 empresas (CNPJs) atingido para este cliente';
  end if;

  clean_cnpj := nullif(regexp_replace(coalesce(company_cnpj, ''), '\D', '', 'g'), '');

  insert into companies (name, cnpj) values (company_name, clean_cnpj)
  returning id into new_company_id;

  insert into company_members (company_id, user_id, role)
  values (new_company_id, auth.uid(), 'admin');

  select json_build_object('id', c.id, 'name', c.name, 'cnpj', c.cnpj, 'org_id', c.org_id)
    into result from companies c where c.id = new_company_id;
  return result;
end;
$function$;

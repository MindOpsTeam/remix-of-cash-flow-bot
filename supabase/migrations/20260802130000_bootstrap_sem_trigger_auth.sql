-- O bootstrap da instalação não pode depender de gatilho em auth.users.
--
-- Descoberto testando um remix de verdade: o Lovable provisiona o banco novo com
-- o schema `public`, mas os GATILHOS em `auth.users` não vêm junto (criar trigger
-- ali exige ser dono da tabela, e o runner de migration não é). As FUNÇÕES
-- estavam lá; os gatilhos, não.
--
-- Consequência medida no remix, antes desta correção:
--   * o primeiro usuário se cadastrava e NÃO virava dono da plataforma;
--   * sem dono, `cadastro_esta_aberto()` seguia true para sempre — a trava de
--     convite nunca engatava e qualquer um podia criar conta;
--   * o wizard de configuração não abria.
--
-- Correção: a garantia passa a morar no schema `public`, que sobrevive ao remix.
-- Os gatilhos continuam onde existem (defesa em profundidade), mas nada mais
-- depende deles.

/**
 * Consagra quem chama como dono da instalação, se ainda não houver um.
 *
 * Idempotente e à prova de corrida: a tabela tem PK fixa (id = true), então o
 * primeiro INSERT vence e os demais viram no-op. Não dá para roubar o posto
 * depois — é exatamente a mesma regra do gatilho, só que num lugar que sobrevive.
 */
CREATE OR REPLACE FUNCTION public.consagrar_dono_se_primeiro()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email text;
BEGIN
  IF auth.uid() IS NULL THEN RETURN false; END IF;

  SELECT email INTO v_email FROM auth.users WHERE id = auth.uid();
  -- A conta de demonstração é vitrine, nunca dona da instalação.
  IF lower(coalesce(v_email, '')) IN ('demo@financeai.app', 'dono-demo@financeai.app') THEN
    RETURN false;
  END IF;

  INSERT INTO public.platform_owner (id, user_id)
  VALUES (true, auth.uid())
  ON CONFLICT (id) DO NOTHING;

  RETURN EXISTS (SELECT 1 FROM public.platform_owner WHERE user_id = auth.uid());
END;
$$;

REVOKE EXECUTE ON FUNCTION public.consagrar_dono_se_primeiro() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.consagrar_dono_se_primeiro() TO authenticated;

/**
 * Criar empresa passa a ser o portão que realmente vale.
 *
 * Sem gatilho em auth.users, o cadastro em si não pode ser barrado no banco. Mas
 * conta que não cria empresa e não recebe convite é conta INERTE: não enxerga
 * nada e não vira inquilino paralelo. É aqui que o isolamento se sustenta.
 *
 * Quem pode criar empresa:
 *   1. ninguém é dono ainda → o primeiro cria a dele e vira dono;
 *   2. o dono da plataforma;
 *   3. quem já é ADMIN de alguma empresa (abrir outro CNPJ do grupo).
 * Qualquer outro caso precisa de convite, e convite leva para uma empresa que já
 * existe — não cria uma nova.
 */
CREATE OR REPLACE FUNCTION public.create_company_for_user(company_name text, company_cnpj text DEFAULT NULL)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_company_id uuid;
  n_companies int;
  clean_cnpj text;
  result json;
  v_tem_dono boolean;
  v_pode boolean;
BEGIN
  IF public.plataforma_bloqueada() THEN
    RAISE EXCEPTION 'Este é o projeto original (somente leitura). Remixe para criar empresas.' USING errcode = '42501';
  END IF;
  IF public.is_demo_account() THEN
    RAISE EXCEPTION 'A conta de demonstração não pode criar empresas.' USING errcode = '42501';
  END IF;

  SELECT EXISTS (SELECT 1 FROM public.platform_owner) INTO v_tem_dono;
  v_pode := (NOT v_tem_dono)
         OR public.sou_dono_da_plataforma()
         OR EXISTS (SELECT 1 FROM public.company_members
                     WHERE user_id = auth.uid() AND role = 'admin');
  IF NOT v_pode THEN
    RAISE EXCEPTION 'Só o administrador da plataforma abre novas empresas. Peça um convite para entrar numa que já existe.'
      USING errcode = '42501';
  END IF;

  SELECT count(*) INTO n_companies FROM company_members WHERE user_id = auth.uid();
  IF n_companies >= 6 THEN
    RAISE EXCEPTION 'Limite de 6 empresas (CNPJs) atingido para este cliente';
  END IF;

  clean_cnpj := nullif(regexp_replace(coalesce(company_cnpj, ''), '\D', '', 'g'), '');

  INSERT INTO companies (name, cnpj) VALUES (company_name, clean_cnpj)
  RETURNING id INTO new_company_id;

  INSERT INTO company_members (company_id, user_id, role)
  VALUES (new_company_id, auth.uid(), 'admin');

  -- Quem cria a primeira empresa da instalação é o dono dela.
  IF NOT v_tem_dono THEN
    INSERT INTO public.platform_owner (id, user_id) VALUES (true, auth.uid())
    ON CONFLICT (id) DO NOTHING;
  END IF;

  SELECT json_build_object('id', c.id, 'name', c.name, 'cnpj', c.cnpj, 'org_id', c.org_id)
    INTO result FROM companies c WHERE c.id = new_company_id;
  RETURN result;
END;
$$;

COMMENT ON FUNCTION public.consagrar_dono_se_primeiro() IS
  'Chamada pelo app no login. Existe porque gatilho em auth.users não sobrevive ao remix do Lovable — a garantia precisa morar no schema public.';

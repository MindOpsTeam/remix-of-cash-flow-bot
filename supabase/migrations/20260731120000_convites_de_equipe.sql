-- Convite de equipe que FUNCIONA (gap achado no PDCA: a tela de Usuários
-- copiava um link /?invite=<company_id> que nenhum código consumia — convite
-- morto em produção).
--
-- Modelo: o admin gera um convite com token próprio, papel e validade de 7
-- dias; o convidado abre o link, cria conta ou entra, e o aceite vira
-- company_members com o papel do convite. Token é bearer de UMA vaga: aceite
-- marca usado. company_id nunca mais aparece em URL.

CREATE TABLE IF NOT EXISTS public.company_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  token uuid NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  role text NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'member', 'viewer')),
  criado_por uuid NOT NULL,
  usado_por uuid,
  usado_em timestamptz,
  expira_em timestamptz NOT NULL DEFAULT now() + interval '7 days',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.company_invites ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members manage invites" ON public.company_invites;
CREATE POLICY "Members manage invites"
  ON public.company_invites FOR ALL
  USING (public.is_company_member(company_id))
  WITH CHECK (public.is_company_member(company_id));

-- Quem cria convite precisa poder escrever (viewer não convida).
DROP POLICY IF EXISTS "Viewer nao convida" ON public.company_invites;
CREATE POLICY "Viewer nao convida"
  ON public.company_invites AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.pode_escrever_na_empresa(company_id));

-- Aceite: SECURITY DEFINER porque o convidado ainda NÃO é membro (a RLS o
-- barraria de ler o convite). Toda validação é explícita.
CREATE OR REPLACE FUNCTION public.aceitar_convite(p_token uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_convite record;
  v_empresa text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Entre na sua conta para aceitar o convite.' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_convite FROM public.company_invites
   WHERE token = p_token
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Convite não encontrado.' USING ERRCODE = '23514';
  END IF;
  IF v_convite.usado_em IS NOT NULL THEN
    RAISE EXCEPTION 'Este convite já foi usado.' USING ERRCODE = '23514';
  END IF;
  IF v_convite.expira_em < now() THEN
    RAISE EXCEPTION 'Este convite expirou. Peça um novo ao administrador.' USING ERRCODE = '23514';
  END IF;

  -- Já é membro? Aceite vira no-op amigável (não queima o convite).
  IF EXISTS (SELECT 1 FROM public.company_members WHERE company_id = v_convite.company_id AND user_id = auth.uid()) THEN
    SELECT name INTO v_empresa FROM public.companies WHERE id = v_convite.company_id;
    RETURN jsonb_build_object('ok', true, 'ja_era_membro', true, 'empresa', v_empresa);
  END IF;

  INSERT INTO public.company_members (company_id, user_id, role, onboarding_completed)
  VALUES (v_convite.company_id, auth.uid(), v_convite.role, true);

  UPDATE public.company_invites
     SET usado_por = auth.uid(), usado_em = now()
   WHERE id = v_convite.id;

  SELECT name INTO v_empresa FROM public.companies WHERE id = v_convite.company_id;
  RETURN jsonb_build_object('ok', true, 'ja_era_membro', false, 'empresa', v_empresa, 'role', v_convite.role);
END;
$$;

REVOKE ALL ON FUNCTION public.aceitar_convite(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.aceitar_convite(uuid) TO authenticated;

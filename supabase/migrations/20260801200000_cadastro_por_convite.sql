-- Depois do primeiro usuário, cadastro é por CONVITE.
--
-- Buraco que isto fecha: com o cadastro aberto, qualquer pessoa que chegasse na
-- URL criava conta e, com ela, a PRÓPRIA empresa — virando 'admin' dela por
-- create_company_for_user. Não enxergaria o dado de ninguém (a RLS garante),
-- mas passaria a existir dentro da instalação do cliente como um inquilino
-- paralelo e invisível. Numa entrega whitelabel isso não é multi-tenant: é
-- estranho dentro de casa.
--
-- Regra: o PRIMEIRO cadastro é sempre livre — é ele que vira o administrador da
-- plataforma. A partir daí, só entra quem tem convite válido, a menos que o dono
-- reabra o autosserviço de propósito.
--
-- O papel de quem entra continua vindo do convite ('member' por padrão, o admin
-- escolhe na tela de Usuários). Ou seja: primeiro usuário = admin; os próximos =
-- o que o admin decidir. É exatamente esse o desenho.

CREATE TABLE IF NOT EXISTS public.platform_settings (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  cadastro_aberto boolean NOT NULL DEFAULT false,
  atualizado_em timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.platform_settings (id, cadastro_aberto) VALUES (true, false)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;

-- Leitura livre: a tela de cadastro precisa saber ANTES de o usuário preencher
-- o formulário. Escrita: só pela RPC, que confere se quem chama é o dono.
DROP POLICY IF EXISTS "Todos leem as preferencias da plataforma" ON public.platform_settings;
CREATE POLICY "Todos leem as preferencias da plataforma"
  ON public.platform_settings FOR SELECT USING (true);

/**
 * Este cadastro pode acontecer? Decisão isolada do gatilho, para ser testável
 * sem precisar inserir em auth.users (que é justamente o que está barrado).
 *
 * Devolve o motivo junto: a mensagem que a pessoa lê depende de POR QUE foi
 * negado, e adivinhar isso na tela produziria texto genérico.
 */
CREATE OR REPLACE FUNCTION public.cadastro_permitido(p_email text, p_convite uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tem_dono boolean;
  v_aberto boolean;
  v_convite record;
BEGIN
  -- Contas da vitrine são criadas pelo seed, nunca por formulário.
  IF lower(coalesce(p_email, '')) IN ('demo@financeai.app', 'dono-demo@financeai.app') THEN
    RETURN jsonb_build_object('permitido', true, 'motivo', 'conta de demonstração');
  END IF;

  SELECT EXISTS (SELECT 1 FROM public.platform_owner) INTO v_tem_dono;
  IF NOT v_tem_dono THEN
    RETURN jsonb_build_object('permitido', true, 'motivo', 'primeiro cadastro: vira o administrador da plataforma');
  END IF;

  SELECT cadastro_aberto INTO v_aberto FROM public.platform_settings WHERE id;
  IF coalesce(v_aberto, false) THEN
    RETURN jsonb_build_object('permitido', true, 'motivo', 'autosserviço liberado pelo administrador');
  END IF;

  IF p_convite IS NOT NULL THEN
    SELECT * INTO v_convite FROM public.company_invites WHERE token = p_convite;
    IF NOT FOUND THEN
      RETURN jsonb_build_object('permitido', false, 'motivo', 'Este convite não existe.');
    END IF;
    IF v_convite.usado_em IS NOT NULL THEN
      RETURN jsonb_build_object('permitido', false, 'motivo', 'Este convite já foi usado.');
    END IF;
    IF v_convite.expira_em < now() THEN
      RETURN jsonb_build_object('permitido', false, 'motivo', 'Este convite expirou. Peça um novo ao administrador.');
    END IF;
    RETURN jsonb_build_object('permitido', true, 'motivo', 'convite válido');
  END IF;

  RETURN jsonb_build_object(
    'permitido', false,
    'motivo', 'Esta plataforma aceita novos usuários apenas por convite. Peça um link ao administrador.'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.cadastro_permitido(text, uuid) TO anon, authenticated, service_role;

/**
 * Barra o cadastro na raiz. Precisa ser no banco, e não na tela: esconder o
 * formulário não impede ninguém de chamar a API de signup direto.
 *
 * O token vem em raw_user_meta_data porque é o único canal que o GoTrue leva do
 * formulário até aqui (options.data no signUp).
 */
CREATE OR REPLACE FUNCTION public.bloqueia_cadastro_sem_convite()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_convite uuid;
  v_veredito jsonb;
BEGIN
  BEGIN
    v_convite := nullif(NEW.raw_user_meta_data->>'convite', '')::uuid;
  EXCEPTION WHEN others THEN
    v_convite := NULL;  -- token malformado é o mesmo que token nenhum
  END;

  v_veredito := public.cadastro_permitido(NEW.email, v_convite);
  IF (v_veredito->>'permitido')::boolean THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'CONVITE_NECESSARIO: %', v_veredito->>'motivo' USING ERRCODE = '42501';
END;
$$;

DROP TRIGGER IF EXISTS trg_bloqueia_cadastro_sem_convite ON auth.users;
CREATE TRIGGER trg_bloqueia_cadastro_sem_convite
  BEFORE INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.bloqueia_cadastro_sem_convite();

/** A tela precisa saber se ainda vale mostrar o formulário de criar conta. */
CREATE OR REPLACE FUNCTION public.cadastro_esta_aberto()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT NOT EXISTS (SELECT 1 FROM public.platform_owner)
      OR coalesce((SELECT cadastro_aberto FROM public.platform_settings WHERE id), false);
$$;

GRANT EXECUTE ON FUNCTION public.cadastro_esta_aberto() TO anon, authenticated, service_role;

/** Só o dono da instalação abre ou fecha o autosserviço. */
CREATE OR REPLACE FUNCTION public.definir_cadastro_aberto(p_aberto boolean)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.sou_dono_da_plataforma() THEN
    RAISE EXCEPTION 'Só o administrador da plataforma muda como novos usuários entram.'
      USING ERRCODE = '42501';
  END IF;
  INSERT INTO public.platform_settings (id, cadastro_aberto, atualizado_em)
  VALUES (true, p_aberto, now())
  ON CONFLICT (id) DO UPDATE SET cadastro_aberto = EXCLUDED.cadastro_aberto, atualizado_em = now();
  RETURN p_aberto;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.definir_cadastro_aberto(boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.definir_cadastro_aberto(boolean) TO authenticated;

COMMENT ON TABLE public.platform_settings IS
  'Preferências da instalação. cadastro_aberto=false (padrão) faz novos usuários entrarem só por convite — o primeiro cadastro é sempre livre e vira o administrador.';

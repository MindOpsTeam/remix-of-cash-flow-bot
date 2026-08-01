-- O primeiro usuário que se cadastrar é o ADMINISTRADOR DA PLATAFORMA.
--
-- No template whitelabel o banco nasce vazio: quem remixa e cria a primeira conta
-- é o dono da instalação. Registramos isso de forma explícita (não por heurística
-- de "membro mais antigo") para o app abrir o assistente de configuração direto
-- para ele e mostrar o botão de concluir a configuração.
--
-- A posse é IMUTÁVEL: só o primeiro grava. Um segundo cadastro não rouba o posto.

CREATE TABLE IF NOT EXISTS public.platform_owner (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  definido_em timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.platform_owner ENABLE ROW LEVEL SECURITY;

-- Todo autenticado pode LER (o app precisa saber se é o dono). Escrita: só o trigger.
DROP POLICY IF EXISTS "Autenticado le o dono da plataforma" ON public.platform_owner;
CREATE POLICY "Autenticado le o dono da plataforma" ON public.platform_owner
  FOR SELECT TO authenticated USING (true);

/** Consagra o primeiro usuário como dono. Idempotente por construção. */
CREATE OR REPLACE FUNCTION public.consagra_primeiro_usuario()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- A conta de demonstração nunca é a dona da instalação: ela é viewer e
  -- existe só para a vitrine. O dono é o primeiro usuário REAL que se cadastra.
  IF NEW.email IN ('demo@financeai.app', 'dono-demo@financeai.app') THEN
    RETURN NEW;
  END IF;
  INSERT INTO public.platform_owner (id, user_id)
  VALUES (true, NEW.id)
  ON CONFLICT (id) DO NOTHING;  -- já existe dono: nada muda
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_consagra_primeiro_usuario ON auth.users;
CREATE TRIGGER trg_consagra_primeiro_usuario
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.consagra_primeiro_usuario();

/** Sou o dono da instalação? Usado pelo app para abrir o wizard e o botão. */
CREATE OR REPLACE FUNCTION public.sou_dono_da_plataforma()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (SELECT 1 FROM public.platform_owner WHERE user_id = auth.uid());
$function$;

GRANT EXECUTE ON FUNCTION public.sou_dono_da_plataforma() TO authenticated;

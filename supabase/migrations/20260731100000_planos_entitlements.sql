-- Monetização: planos e entitlements com enforcement no banco.
--
-- Nada muda para a base atual: toda empresa nasce e permanece em 'trial'
-- (tudo liberado) até alguém mover para base/pro. O teto é gatilho BEFORE
-- INSERT — burlar a UI não burla o limite. Preço em centavos é placeholder
-- ajustável; cobrança efetiva (Asaas) é decisão comercial, não automática.

CREATE TABLE IF NOT EXISTS public.plans (
  key text PRIMARY KEY,
  nome text NOT NULL,
  preco_centavos integer NOT NULL DEFAULT 0,
  max_agentes integer NOT NULL DEFAULT -1,     -- -1 = ilimitado
  max_widgets integer NOT NULL DEFAULT -1,
  whatsapp boolean NOT NULL DEFAULT true,
  pdv boolean NOT NULL DEFAULT true,
  contaazul boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.plans (key, nome, preco_centavos, max_agentes, max_widgets, whatsapp, pdv, contaazul) VALUES
  ('trial', 'Avaliação', 0, -1, -1, true, true, true),
  ('base',  'Base',      14900, 1, 2, false, false, false),
  ('pro',   'Pro',       34900, -1, -1, true, true, true)
ON CONFLICT (key) DO NOTHING;

ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Authenticated read plans" ON public.plans;
CREATE POLICY "Authenticated read plans" ON public.plans FOR SELECT TO authenticated USING (true);

ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS plan_key text NOT NULL DEFAULT 'trial' REFERENCES public.plans(key);

CREATE OR REPLACE FUNCTION public.plano_da_empresa(p_company_id uuid)
RETURNS public.plans
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.* FROM public.plans p
  JOIN public.companies c ON c.plan_key = p.key
  WHERE c.id = p_company_id;
$$;

-- Tetos: agentes ativos e widgets de BI.
CREATE OR REPLACE FUNCTION public.checar_teto_agentes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_plano public.plans;
  v_ativos integer;
BEGIN
  v_plano := public.plano_da_empresa(NEW.company_id);
  IF v_plano.max_agentes >= 0 THEN
    SELECT count(*) INTO v_ativos FROM public.agent_instances
     WHERE company_id = NEW.company_id AND ativo = true AND id IS DISTINCT FROM NEW.id;
    IF NEW.ativo AND v_ativos >= v_plano.max_agentes THEN
      RAISE EXCEPTION 'O plano % permite % agente(s) ativo(s). Fale com o time para subir de plano.',
        v_plano.nome, v_plano.max_agentes USING ERRCODE = 'P0001';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_teto_agentes ON public.agent_instances;
CREATE TRIGGER trg_teto_agentes
  BEFORE INSERT OR UPDATE OF ativo ON public.agent_instances
  FOR EACH ROW EXECUTE FUNCTION public.checar_teto_agentes();

CREATE OR REPLACE FUNCTION public.checar_teto_widgets()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_plano public.plans;
  v_qtd integer;
BEGIN
  v_plano := public.plano_da_empresa(NEW.company_id);
  IF v_plano.max_widgets >= 0 THEN
    SELECT count(*) INTO v_qtd FROM public.dashboard_widgets WHERE company_id = NEW.company_id;
    IF v_qtd >= v_plano.max_widgets THEN
      RAISE EXCEPTION 'O plano % permite % visão(ões) de BI. Fale com o time para subir de plano.',
        v_plano.nome, v_plano.max_widgets USING ERRCODE = 'P0001';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_teto_widgets ON public.dashboard_widgets;
CREATE TRIGGER trg_teto_widgets
  BEFORE INSERT ON public.dashboard_widgets
  FOR EACH ROW EXECUTE FUNCTION public.checar_teto_widgets();

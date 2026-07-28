-- Fundação de IA. Três coisas que faltavam para a IA deixar de ser opinião:
-- medir quanto custa, aprender com a correção humana, e ter caminho
-- determinístico antes de chamar modelo.

-- Consumo por empresa e por função. Sem isto não se sabe qual cliente queima a
-- margem, e sem saber não dá para degradar para o caminho barato em vez de
-- derrubar a funcionalidade.
CREATE TABLE IF NOT EXISTS public.ai_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
  funcao text NOT NULL,
  modelo text,
  prompt_tokens integer DEFAULT 0,
  completion_tokens integer DEFAULT 0,
  custo_centavos numeric DEFAULT 0,
  sucesso boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.ai_usage ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Members can view ai usage" ON public.ai_usage;
CREATE POLICY "Members can view ai usage" ON public.ai_usage
  FOR SELECT TO authenticated USING (public.is_company_member(company_id));
CREATE INDEX IF NOT EXISTS ai_usage_company_created_idx ON public.ai_usage (company_id, created_at DESC);

-- Regras aprendidas. Toda correção humana vira regra, e a regra roda ANTES do
-- modelo. É o que faz custo cair e acurácia subir ao mesmo tempo.
CREATE TABLE IF NOT EXISTS public.classification_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  padrao text NOT NULL,
  account_id uuid REFERENCES public.chart_of_accounts(id) ON DELETE CASCADE,
  cost_center_id uuid REFERENCES public.cost_centers(id) ON DELETE SET NULL,
  acertos integer NOT NULL DEFAULT 0,
  origem text NOT NULL DEFAULT 'humano' CHECK (origem IN ('humano','importacao','semente')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, padrao)
);
ALTER TABLE public.classification_rules ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Members manage classification rules" ON public.classification_rules;
CREATE POLICY "Members manage classification rules" ON public.classification_rules
  FOR ALL TO authenticated USING (public.is_company_member(company_id))
  WITH CHECK (public.is_company_member(company_id));

-- Placar da IA: o que sugeriu e o que o humano aceitou. É o número que se
-- mostra ao cliente e o dado que gera a regra.
CREATE TABLE IF NOT EXISTS public.ai_classification_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  transaction_id uuid REFERENCES public.transactions(id) ON DELETE CASCADE,
  descricao text,
  sugerido_account_id uuid,
  aceito boolean NOT NULL,
  final_account_id uuid,
  origem text NOT NULL DEFAULT 'ia' CHECK (origem IN ('ia','regra')),
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.ai_classification_feedback ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Members view ai feedback" ON public.ai_classification_feedback;
CREATE POLICY "Members view ai feedback" ON public.ai_classification_feedback
  FOR SELECT TO authenticated USING (public.is_company_member(company_id));
DROP POLICY IF EXISTS "Members insert ai feedback" ON public.ai_classification_feedback;
CREATE POLICY "Members insert ai feedback" ON public.ai_classification_feedback
  FOR INSERT TO authenticated WITH CHECK (public.is_company_member(company_id));

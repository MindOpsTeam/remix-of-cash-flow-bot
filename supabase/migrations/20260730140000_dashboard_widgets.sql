-- BI self-service: visões que o cliente monta e deixa no cockpit.
--
-- O catálogo de métricas × dimensões × tipos é código (src/lib/bi-catalog.ts,
-- com validação zod no builder); aqui vive só a escolha. Widgets são da
-- EMPRESA (visíveis a todos os membros) com autor registrado — BI de grupo,
-- não rascunho pessoal.

CREATE TABLE IF NOT EXISTS public.dashboard_widgets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  titulo text NOT NULL,
  config jsonb NOT NULL,
  posicao integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.dashboard_widgets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members manage dashboard widgets" ON public.dashboard_widgets;
CREATE POLICY "Members manage dashboard widgets"
  ON public.dashboard_widgets FOR ALL
  USING (public.is_company_member(company_id))
  WITH CHECK (public.is_company_member(company_id));

CREATE INDEX IF NOT EXISTS idx_dashboard_widgets_company
  ON public.dashboard_widgets (company_id, posicao);

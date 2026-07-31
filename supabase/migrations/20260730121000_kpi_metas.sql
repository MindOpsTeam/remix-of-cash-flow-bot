-- Metas de indicador (OKR leve) por empresa.
--
-- O cockpit passa a comparar realizado contra alvo declarado. O catálogo de
-- métricas que aceitam meta é código (src/lib/metrics.ts, METAS_CATALOGO):
-- aqui só vive a escolha do cliente. `direcao` resolve métricas onde menor é
-- melhor (inadimplência) sem duplicar catálogo no banco.

CREATE TABLE IF NOT EXISTS public.kpi_metas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  metric_key text NOT NULL,
  alvo numeric NOT NULL,
  direcao text NOT NULL DEFAULT 'acima' CHECK (direcao IN ('acima', 'abaixo')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, metric_key)
);

ALTER TABLE public.kpi_metas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members manage kpi metas" ON public.kpi_metas;
CREATE POLICY "Members manage kpi metas"
  ON public.kpi_metas
  FOR ALL
  USING (public.is_company_member(company_id))
  WITH CHECK (public.is_company_member(company_id));

CREATE INDEX IF NOT EXISTS idx_kpi_metas_company ON public.kpi_metas (company_id);

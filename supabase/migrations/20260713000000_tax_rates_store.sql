-- Serviço nacional de alíquotas — "rate store" temporal + dimensão de municípios.
-- Dados de REFERÊNCIA nacionais (não têm company_id): leitura por qualquer usuário
-- autenticado, escrita só pela edge tax-rates-sync (service role bypassa RLS).
-- Ver docs/INTEGRADOR-NACIONAL-ALIQUOTAS.md. Aditiva e idempotente.
-- NÃO toca no ledger transactions/DRE — infraestrutura fiscal separada.

-- Dimensão de municípios (fonte: IBGE Localidades; id de 7 dígitos = cMun fiscal)
CREATE TABLE IF NOT EXISTS public.municipalities (
  code_ibge text PRIMARY KEY,          -- 7 dígitos, é o próprio cMun da NF-e/NFS-e
  name text NOT NULL,
  uf text NOT NULL,
  region text,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS municipalities_uf ON public.municipalities (uf);

-- Rate store temporal: toda linha datada por vigência [inicio, fim).
-- Query canônica: alíquota(tax, ente_code, item_code, competência).
CREATE TABLE IF NOT EXISTS public.tax_rates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tax text NOT NULL CHECK (tax IN ('iss', 'cbs', 'ibs', 'icms_interno', 'icms_fcp')),
  -- Ente: código IBGE (7d) p/ município ISS; sigla UF p/ ICMS; 'BR' p/ nacional (CBS)
  ente_code text NOT NULL,
  -- Item: subitem LC 116 p/ ISS; cClassTrib p/ IBS/CBS; NULL = alíquota geral
  item_code text,
  rate numeric(8,4) NOT NULL,          -- percentual
  vigencia_inicio date NOT NULL,
  vigencia_fim date,                   -- NULL = vigente
  source text NOT NULL,                -- 'adn' | 'lei' | 'senado' | 'calculadora' | 'seed'
  version text,
  confidence text NOT NULL DEFAULT 'oficial'
    CHECK (confidence IN ('oficial', 'estimado', 'revisar')),
  notes text,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS tax_rates_lookup
  ON public.tax_rates (tax, ente_code, item_code, vigencia_inicio DESC);

ALTER TABLE public.municipalities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tax_rates ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Reference data readable by authenticated"
    ON public.municipalities FOR SELECT TO authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Tax rates readable by authenticated"
    ON public.tax_rates FOR SELECT TO authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Reforma Tributária (LC 214/2025, NT 2025.002): campos de destaque CBS/IBS.
-- Aditiva e idempotente — nenhuma coluna existente é alterada.

-- Regime tributário e classificação padrão por empresa (alimenta o checklist
-- "Pronto para a Reforma" e o cálculo do destaque na emissão).
ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS regime_tributario text
    CHECK (regime_tributario IN ('simples', 'regular', 'mei')),
  ADD COLUMN IF NOT EXISTS cclasstrib_padrao text;

-- Destaque efetivamente calculado por documento emitido (auditoria/relatório).
ALTER TABLE public.plugnotas_documents
  ADD COLUMN IF NOT EXISTS cbs_valor numeric(14,2),
  ADD COLUMN IF NOT EXISTS ibs_valor numeric(14,2),
  ADD COLUMN IF NOT EXISTS cbs_aliquota numeric(6,4),
  ADD COLUMN IF NOT EXISTS ibs_aliquota numeric(6,4),
  ADD COLUMN IF NOT EXISTS cclasstrib text;

ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS cbs_valor numeric(14,2),
  ADD COLUMN IF NOT EXISTS ibs_valor numeric(14,2),
  ADD COLUMN IF NOT EXISTS cclasstrib text;

COMMENT ON COLUMN public.companies.regime_tributario IS
  'simples | regular | mei — define quando o destaque CBS/IBS é obrigatório (regular: 2026; simples: 2027; mei: nunca)';
COMMENT ON COLUMN public.companies.cclasstrib_padrao IS
  'Código de classificação tributária padrão (tabela nacional cClassTrib) usado na emissão';

-- cClassTrib por produto/serviço: sobrepõe o padrão da empresa no destaque
-- CBS/IBS por item (regras de consistência CST×cClassTrib da NT 2025.002).
-- Aditiva e idempotente.

ALTER TABLE public.products ADD COLUMN IF NOT EXISTS cclasstrib text;
COMMENT ON COLUMN public.products.cclasstrib IS
  'cClassTrib do produto/serviço (sobrepõe o padrão da empresa no destaque CBS/IBS)';

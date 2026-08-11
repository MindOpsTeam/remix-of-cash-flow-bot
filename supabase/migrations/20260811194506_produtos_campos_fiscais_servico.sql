-- Campos fiscais de SERVIÇO no catálogo (products.type='service'), para NFS-e.
-- Assim o cliente cadastra o serviço uma vez (código de tributação nacional,
-- alíquota ISS, NBS, código municipal, CNAE) e a emissão puxa do cadastro.
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS codigo_trib_nac          text,
  ADD COLUMN IF NOT EXISTS codigo_servico_municipal text,
  ADD COLUMN IF NOT EXISTS nbs                      text,
  ADD COLUMN IF NOT EXISTS aliquota_iss             numeric,
  ADD COLUMN IF NOT EXISTS cnae                     text;

COMMENT ON COLUMN public.products.codigo_trib_nac IS 'Código de tributação nacional (cTribNac) da NFS-e, para serviços.';
COMMENT ON COLUMN public.products.codigo_servico_municipal IS 'Código de serviço da prefeitura (quando exigido).';
COMMENT ON COLUMN public.products.nbs IS 'Nomenclatura Brasileira de Serviços (opcional).';
COMMENT ON COLUMN public.products.aliquota_iss IS 'Alíquota do ISS (%) do serviço.';
COMMENT ON COLUMN public.products.cnae IS 'CNAE associado ao serviço.';

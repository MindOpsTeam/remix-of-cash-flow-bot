-- Item da lista de serviços (LC 116/2003), exigido pela NFS-e via PlugNotas e Focus.
-- Complementa os campos fiscais de serviço já adicionados em products.
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS item_lista_servico text;
COMMENT ON COLUMN public.products.item_lista_servico IS 'Item da lista de serviços LC 116 (ex.: 1.07). Usado por PlugNotas e Focus na NFS-e.';

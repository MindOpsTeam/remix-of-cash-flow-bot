-- Reforma NFS-e: guarda do XML fiscal, idempotência, regime tributário e progresso do wizard.
-- Tudo aditivo e retrocompatível.

-- Regime e progresso da instalação na config da empresa.
ALTER TABLE public.nfse_config
  ADD COLUMN IF NOT EXISTS optante_simples boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS setup_step      integer NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.nfse_config.optante_simples IS 'Empresa é optante do Simples Nacional (define opSimpNac no DPS). Default true (público-alvo).';
COMMENT ON COLUMN public.nfse_config.setup_step IS 'Passo concluído do assistente de instalação NFS-e (0 = não iniciado).';

-- Documentos fiscais e idempotência nas notas emitidas.
ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS chave_acesso    text,
  ADD COLUMN IF NOT EXISTS dps_xml         text,
  ADD COLUMN IF NOT EXISTS nfse_xml        text,
  ADD COLUMN IF NOT EXISTS sefin_ambiente  text,
  ADD COLUMN IF NOT EXISTS idempotency_key text;

COMMENT ON COLUMN public.invoices.chave_acesso IS 'Chave de acesso (50 díg) da NFS-e autorizada pelo SEFIN.';
COMMENT ON COLUMN public.invoices.dps_xml IS 'DPS assinado enviado ao SEFIN.';
COMMENT ON COLUMN public.invoices.nfse_xml IS 'XML da NFS-e autorizada (guarda fiscal 5 anos).';
COMMENT ON COLUMN public.invoices.idempotency_key IS 'Chave de idempotência da emissão (evita nota duplicada em retry).';

-- Uma emissão por chave de idempotência, por empresa.
CREATE UNIQUE INDEX IF NOT EXISTS invoices_company_idempotency_uidx
  ON public.invoices (company_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

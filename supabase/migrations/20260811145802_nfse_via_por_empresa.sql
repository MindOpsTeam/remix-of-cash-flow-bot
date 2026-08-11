-- NFS-e por empresa (modelo remix distribuído): cada empresa aponta para o seu
-- próprio worker de emissão, em vez de um worker global via env. Também registra
-- qual VIA a empresa usa (servidor próprio x provedor SaaS).
--
-- Colunas aditivas e nulas: instalações existentes seguem funcionando (a edge
-- nfse-proxy cai no env NFSE_WORKER_URL/KEY quando worker_url vier vazio).

ALTER TABLE public.nfse_config
  ADD COLUMN IF NOT EXISTS nfse_via     text NOT NULL DEFAULT 'worker_proprio',
  ADD COLUMN IF NOT EXISTS worker_url    text,
  ADD COLUMN IF NOT EXISTS worker_api_key text;

-- Só dois valores previstos: 'worker_proprio' (via gratuita, servidor do cliente)
-- e 'provedor' (emissão via SaaS pago por nota — PlugNotas/Focus).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'nfse_config_nfse_via_check'
  ) THEN
    ALTER TABLE public.nfse_config
      ADD CONSTRAINT nfse_config_nfse_via_check
      CHECK (nfse_via IN ('worker_proprio', 'provedor'));
  END IF;
END $$;

COMMENT ON COLUMN public.nfse_config.nfse_via IS 'Via de emissão: worker_proprio (servidor do cliente, notas ilimitadas) | provedor (SaaS pago por nota)';
COMMENT ON COLUMN public.nfse_config.worker_url IS 'URL pública do worker de emissão desta empresa (ex.: https://xxx.up.railway.app). Vazio = usa o env NFSE_WORKER_URL.';
COMMENT ON COLUMN public.nfse_config.worker_api_key IS 'X-API-Key do worker desta empresa. Vazio = usa o env NFSE_WORKER_API_KEY. TODO: migrar para Vault (ver AUDITORIA-NFSE P1).';

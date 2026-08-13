-- Resíduo da revisão (2026-08-12) — Tec-H6/P1 da auditoria: o certificado A1, a
-- senha e a chave do worker ficavam LEGÍVEIS por qualquer membro da empresa (SELECT
-- via RLS). Segredo fiscal não pode trafegar para o navegador de todo mundo.
--
-- Correção: revoga o SELECT dessas colunas para anon/authenticated (o cert deixa de
-- ser lido pelo cliente) e cria um RPC SECURITY DEFINER, só para o service_role, que
-- os edges (nfse-proxy) usam para ler o segredo no servidor. As gravações continuam
-- (o wizard sobe um .pfx novo); o status "configurado" passa a usar cert_cnpj (não
-- secreto). O nfse-operations já usa service_role e não é afetado.

-- Fecha a leitura do segredo pelo cliente. Mantém INSERT/UPDATE (o upload do .pfx).
REVOKE SELECT (cert_pfx_base64, cert_password, worker_api_key)
  ON public.nfse_config FROM anon, authenticated;

-- Leitura server-side dos segredos (usada pelos edges com service_role).
CREATE OR REPLACE FUNCTION public.get_nfse_secrets(p_company_id uuid)
RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT jsonb_build_object(
    'cert_pfx_base64', cert_pfx_base64,
    'cert_password',   cert_password,
    'worker_api_key',  worker_api_key
  )
  FROM public.nfse_config
  WHERE company_id = p_company_id
  LIMIT 1;
$$;

REVOKE EXECUTE ON FUNCTION public.get_nfse_secrets(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_nfse_secrets(uuid) TO service_role;

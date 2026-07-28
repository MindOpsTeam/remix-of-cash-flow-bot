-- Produto que se classifica e que pode emitir nota.
--
-- Dois problemas medidos nos 22 produtos cadastrados em produção:
--
--   22 de 22 sem `account_id`. A coluna existe desde sempre e a tela nunca a
--   expôs, então a venda nasce sem conta contábil. É uma das origens dos 32%
--   de lançamentos que somem do resultado.
--
--   22 de 22 sem `cclasstrib` e 19 de 22 sem NCM. A partir de 03/08/2026 o
--   grupo IBS/CBS é obrigatório no documento fiscal, e a LC 227/2026 art.
--   341-G VI põe a multa em quem DESENVOLVE o software, não no cliente. Ou
--   seja: produto sem classificação fiscal depois dessa data é exposição
--   nossa, não do cliente.
--
-- Sobre a tabela oficial de cClassTrib: o conselho foi explícito em que ela
-- deve ser CARREGADA da planilha versionada, nunca escrita à mão no código.
-- Esta migration cria o lugar onde ela mora, e ele nasce VAZIO de propósito.
-- Enquanto não for carregada, a sugestão da IA é aceita como candidata e fica
-- marcada como tal; ninguém finge que houve validação oficial.

CREATE TABLE IF NOT EXISTS public.cclasstrib_codigos (
  codigo text PRIMARY KEY,
  descricao text NOT NULL,
  /* Quais CST aceitam este código, conforme a NT. Vazio = sem restrição conhecida. */
  cst_permitidos text[] NOT NULL DEFAULT '{}',
  /* De onde veio a linha. 'oficial' só para o que foi carregado da planilha. */
  fonte text NOT NULL DEFAULT 'oficial' CHECK (fonte IN ('oficial')),
  versao text,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Tabela de domínio fiscal, igual para todas as empresas: leitura para quem
-- está autenticado, escrita só por service_role, que é quem carrega a planilha.
ALTER TABLE public.cclasstrib_codigos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Autenticado le codigos" ON public.cclasstrib_codigos;
CREATE POLICY "Autenticado le codigos" ON public.cclasstrib_codigos
  FOR SELECT TO authenticated USING (true);

REVOKE ALL ON public.cclasstrib_codigos FROM anon, authenticated;
GRANT SELECT ON public.cclasstrib_codigos TO authenticated;

COMMENT ON TABLE public.cclasstrib_codigos IS
  'Tabela oficial de cClassTrib, carregada da planilha versionada. Nasce vazia: código escrito à mão aqui é exatamente o que o conselho proibiu.';

-- Rastro da classificação fiscal do produto: quem preencheu e com que confiança.
-- Sem isto não dá para separar o que um humano conferiu do que a IA chutou, e
-- é essa diferença que decide se a empresa pode emitir com segurança.
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS fiscal_origem text
    CHECK (fiscal_origem IS NULL OR fiscal_origem IN ('humano', 'ia', 'importacao')),
  ADD COLUMN IF NOT EXISTS fiscal_confirmado_em timestamptz,
  ADD COLUMN IF NOT EXISTS fiscal_confirmado_por uuid;

/**
 * O que falta em cada produto para ele poder emitir documento com IBS/CBS.
 *
 * Mercadoria precisa de NCM; serviço não. Os dois precisam de cClassTrib a
 * partir de 03/08/2026. `account_id` não é exigência fiscal, mas sem ele a
 * venda nasce sem conta contábil, então entra na mesma varredura.
 */
CREATE OR REPLACE VIEW public.v_produtos_pendencia_fiscal
WITH (security_invoker = on) AS
 SELECT
    p.id,
    p.company_id,
    p.name,
    p.type,
    p.sku,
    p.ncm,
    p.cclasstrib,
    p.account_id,
    p.fiscal_origem,
    p.fiscal_confirmado_em,
    (p.type <> 'service' AND COALESCE(p.ncm, '') = '') AS falta_ncm,
    (COALESCE(p.cclasstrib, '') = '') AS falta_cclasstrib,
    (p.account_id IS NULL) AS falta_conta,
    -- Emite ou não emite depois de 3 de agosto. É esta coluna que a tela mostra.
    ((p.type <> 'service' AND COALESCE(p.ncm, '') = '') OR COALESCE(p.cclasstrib, '') = '')
      AS bloqueia_emissao
   FROM public.products p
  WHERE p.active = true;

REVOKE ALL ON public.v_produtos_pendencia_fiscal FROM anon;
GRANT SELECT ON public.v_produtos_pendencia_fiscal TO authenticated;

COMMENT ON VIEW public.v_produtos_pendencia_fiscal IS
  'O que falta em cada produto ativo para emitir documento com IBS/CBS a partir de 03/08/2026.';

-- Deduções de receita, e a régua de ativação.
--
-- DUAS COISAS.
--
-- 1. DEDUÇÕES DE RECEITA. O DRE ia de Receita Bruta direto para Custos, ou
--    seja, não existia Receita Líquida. Para uma empresa do Simples que paga
--    imposto sobre faturamento, isso infla a receita e desloca toda margem
--    calculada em cima dela. É a linha que o contador procura primeiro.
--
-- 2. ATIVAÇÃO. O número que explica o produto, segundo o conselho: 2.877 linhas
--    de configuração para 34 lançamentos reais, e a mediana dos usuários nunca
--    lançou nada. Não dava para medir isso sem varrer tabela por tabela.
--
-- A ativação vem de VIEW derivada dos dados que já existem, e não de eventos
-- que alguém precisa lembrar de disparar. Instrumentação esquecida mente para
-- baixo, e um funil que subnotifica é pior que funil nenhum: ele faz o produto
-- parecer pior do que é e manda otimizar a etapa errada.

-- ── 1. Deduções ───────────────────────────────────────────────────────────

ALTER TABLE public.chart_of_accounts
  ADD COLUMN IF NOT EXISTS deducao boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.chart_of_accounts.deducao IS
  'Conta redutora de receita: imposto sobre venda, devolução, desconto incondicional. Entra entre Receita Bruta e Receita Líquida.';

DROP VIEW IF EXISTS public.v_dre_linhas;
CREATE VIEW public.v_dre_linhas
WITH (security_invoker = on) AS
 SELECT
    t.company_id,
    date_trunc('month'::text, t.date::timestamp with time zone)::date AS mes,
    date_trunc('month'::text, COALESCE(t.competencia_date, t.date)::timestamp with time zone)::date
      AS mes_competencia,
    t.account_id,
    coa.code AS account_code,
    coa.name AS account_name,
    t.type,
    t.is_intercompany,
    -- A régua, e o único lugar onde ela vive.
    --
    -- `deducao` é testada ANTES do tipo do lançamento de propósito: imposto
    -- sobre venda costuma ser lançado como despesa, e devolução como receita
    -- negativa. Quem decide que aquilo reduz a receita é a CONTA, não o tipo.
    CASE
      WHEN coa.id IS NULL THEN 'a_classificar'::text
      WHEN coa.deducao THEN 'deducao'::text
      WHEN t.type = 'revenue'::text THEN 'receita'::text
      WHEN t.type = 'expense'::text AND "left"(COALESCE(coa.code, ''::text), 1) = '4'::text THEN 'custo'::text
      ELSE 'despesa'::text
    END AS grupo,
    sum(t.amount) AS total,
    count(*) AS lancamentos
   FROM transactions t
     LEFT JOIN chart_of_accounts coa ON coa.id = t.account_id
  WHERE t.status = ANY (ARRAY['confirmed'::text, 'reconciled'::text])
  GROUP BY t.company_id,
           (date_trunc('month'::text, t.date::timestamp with time zone)),
           (date_trunc('month'::text, COALESCE(t.competencia_date, t.date)::timestamp with time zone)),
           t.account_id, coa.id, coa.code, coa.name, coa.deducao, t.type, t.is_intercompany;

REVOKE ALL ON public.v_dre_linhas FROM anon;
GRANT SELECT ON public.v_dre_linhas TO authenticated;

-- `fechar_mes` passa a congelar a receita líquida junto. Snapshot sem dedução
-- guardaria uma receita que o contador não reconhece.
CREATE OR REPLACE FUNCTION public.fechar_mes(p_company_id uuid, p_mes date)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_mes date := date_trunc('month', p_mes)::date;
  v_regime text;
  v_receita numeric := 0; v_deducoes numeric := 0; v_custos numeric := 0;
  v_despesas numeric := 0; v_a_classificar numeric := 0;
  v_lancamentos bigint := 0; v_snapshot jsonb;
BEGIN
  IF NOT public.is_company_member(p_company_id) THEN
    RAISE EXCEPTION 'Sem acesso a esta empresa.' USING ERRCODE = '42501';
  END IF;
  IF v_mes > date_trunc('month', now())::date THEN
    RAISE EXCEPTION 'Não dá para fechar um mês que ainda não começou.' USING ERRCODE = '23514';
  END IF;

  SELECT COALESCE(regime_apuracao, 'caixa') INTO v_regime FROM public.companies WHERE id = p_company_id;

  SELECT
    COALESCE(sum(total) FILTER (WHERE grupo = 'receita'), 0),
    COALESCE(sum(total) FILTER (WHERE grupo = 'deducao'), 0),
    COALESCE(sum(total) FILTER (WHERE grupo = 'custo'), 0),
    COALESCE(sum(total) FILTER (WHERE grupo = 'despesa'), 0),
    COALESCE(sum(total) FILTER (WHERE grupo = 'a_classificar'), 0),
    COALESCE(sum(lancamentos), 0)
  INTO v_receita, v_deducoes, v_custos, v_despesas, v_a_classificar, v_lancamentos
  FROM public.v_dre_linhas
  WHERE company_id = p_company_id
    AND (CASE WHEN v_regime = 'competencia' THEN mes_competencia ELSE mes END) = v_mes;

  v_snapshot := jsonb_build_object(
    'receita', v_receita,
    'deducoes', v_deducoes,
    'receita_liquida', v_receita - v_deducoes,
    'custos', v_custos,
    'despesas', v_despesas,
    'lucro_bruto', v_receita - v_deducoes - v_custos,
    'lucro_liquido', v_receita - v_deducoes - v_custos - v_despesas,
    'a_classificar', v_a_classificar,
    'lancamentos', v_lancamentos,
    'regua', 'v_dre_linhas', 'regime', v_regime, 'apurado_em', now()
  );

  INSERT INTO public.monthly_close (company_id, month, status, snapshot, closed_at, closed_by)
  VALUES (p_company_id, v_mes, 'closed', v_snapshot, now(), auth.uid())
  ON CONFLICT (company_id, month) DO UPDATE
    SET status = 'closed', snapshot = v_snapshot, closed_at = now(), closed_by = auth.uid();

  RETURN v_snapshot;
END;
$$;

-- ── 2. Ativação ───────────────────────────────────────────────────────────

/**
 * Onde cada empresa parou no caminho de virar usuária.
 *
 * Derivada do dado que já existe, de propósito. A alternativa seria uma tabela
 * de eventos preenchida pela tela, que só mede o que alguém lembrou de
 * instrumentar e nunca cobre quem já usava o produto antes da instrumentação.
 */
CREATE OR REPLACE VIEW public.v_ativacao_empresa
WITH (security_invoker = on) AS
 SELECT
    c.id AS company_id,
    c.name,
    c.created_at,
    (SELECT min(t.created_at) FROM public.transactions t WHERE t.company_id = c.id)
      AS primeiro_lancamento_em,
    (SELECT count(*) FROM public.transactions t WHERE t.company_id = c.id)
      AS lancamentos,
    (SELECT count(*) FROM public.transactions t
      WHERE t.company_id = c.id AND t.source IN ('importacao', 'texto'))
      AS lancamentos_sem_formulario,
    (SELECT count(*) FROM public.transactions t
      WHERE t.company_id = c.id AND t.account_id IS NULL)
      AS lancamentos_sem_conta,
    (SELECT min(r.created_at) FROM public.receivables r WHERE r.company_id = c.id)
      AS primeiro_recebivel_em,
    (SELECT min(mc.closed_at) FROM public.monthly_close mc
      WHERE mc.company_id = c.id AND mc.status = 'closed')
      AS primeiro_fechamento_em,
    (SELECT count(*) FROM public.chart_of_accounts a WHERE a.company_id = c.id)
      AS contas_configuradas,
    -- O número que o conselho usou para descrever o produto: quantas linhas de
    -- andaime foram criadas para cada linha de valor.
    CASE
      WHEN (SELECT count(*) FROM public.transactions t WHERE t.company_id = c.id) = 0 THEN NULL
      ELSE round(
        (SELECT count(*) FROM public.chart_of_accounts a WHERE a.company_id = c.id)::numeric
        / (SELECT count(*) FROM public.transactions t WHERE t.company_id = c.id), 1)
    END AS andaime_por_lancamento,
    CASE
      WHEN (SELECT count(*) FROM public.transactions t WHERE t.company_id = c.id) = 0 THEN 'nunca_lancou'
      WHEN (SELECT count(*) FROM public.transactions t WHERE t.company_id = c.id) < 5 THEN 'experimentou'
      WHEN NOT EXISTS (SELECT 1 FROM public.monthly_close mc
                        WHERE mc.company_id = c.id AND mc.status = 'closed') THEN 'usando'
      ELSE 'ativa'
    END AS estagio
   FROM public.companies c;

REVOKE ALL ON public.v_ativacao_empresa FROM anon;
GRANT SELECT ON public.v_ativacao_empresa TO authenticated;

COMMENT ON VIEW public.v_ativacao_empresa IS
  'Estágio de ativação por empresa, derivado do dado existente: nunca_lancou | experimentou | usando | ativa.';

-- Auditoria de integridade contábil: prova que a cadeia entre tabelas fecha.
--
-- O valor do ERP não está numa tabela isolada, está no ENCADEAMENTO: pedido →
-- recebível → lançamento → conta → centro de custo; contrato → recebível;
-- venda → estoque. Quando um elo quebra, o DRE continua "funcionando" e
-- mostrando número errado — silenciosamente. Esta função procura exatamente
-- esses elos partidos.
--
-- Só leitura: não conserta nada, aponta. Quem decide é o humano.

CREATE OR REPLACE FUNCTION public.auditar_integridade_contabil(p_company_id uuid)
 RETURNS TABLE (
   severidade text,     -- 'erro' (número errado agora) | 'alerta' (risco)
   regra text,          -- identificador curto da regra violada
   descricao text,      -- o que houve, em português
   quantidade bigint,   -- quantas ocorrências
   exemplo text         -- uma amostra para o humano começar a investigar
 )
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.is_company_member(p_company_id) THEN
    RAISE EXCEPTION 'Sem acesso a esta empresa.' USING ERRCODE = '42501';
  END IF;

  -- 1) Natureza invertida: entrada em conta que não é receita (e vice-versa).
  --    Isso corrompe a margem direto, porque a régua do DRE lê type + código.
  RETURN QUERY
  SELECT 'erro', 'natureza_da_conta',
         'Lançamento cuja conta contraria a natureza (receita em conta de despesa ou o inverso).',
         count(*), min(t.description)
  FROM public.transactions t
  JOIN public.chart_of_accounts a ON a.id = t.account_id
  WHERE t.company_id = p_company_id
    AND t.status IN ('confirmed','reconciled')
    AND t.type <> a.type
  HAVING count(*) > 0;

  -- 2) Grupo do plano de contas fora da régua 3/4/5.
  RETURN QUERY
  SELECT 'erro', 'grupo_do_plano',
         'Receita fora do grupo 3, ou custo/despesa fora dos grupos 4 e 5.',
         count(*), min(t.description)
  FROM public.transactions t
  JOIN public.chart_of_accounts a ON a.id = t.account_id
  WHERE t.company_id = p_company_id
    AND t.status IN ('confirmed','reconciled')
    AND (
      (t.type = 'revenue' AND left(coalesce(a.code,''), 1) <> '3') OR
      (t.type = 'expense' AND left(coalesce(a.code,''), 1) NOT IN ('4','5'))
    )
  HAVING count(*) > 0;

  -- 3) Vazamento entre empresas: centro de custo de OUTRO CNPJ.
  --    RLS protege leitura, mas nada impede gravar o id errado no formulário.
  RETURN QUERY
  SELECT 'erro', 'centro_de_outra_empresa',
         'Lançamento apontando para centro de custo que pertence a outra empresa.',
         count(*), min(t.description)
  FROM public.transactions t
  JOIN public.cost_centers cc ON cc.id = t.cost_center_id
  WHERE t.company_id = p_company_id AND cc.company_id <> t.company_id
  HAVING count(*) > 0;

  -- 4) Idem para a conta contábil.
  RETURN QUERY
  SELECT 'erro', 'conta_de_outra_empresa',
         'Lançamento apontando para conta contábil que pertence a outra empresa.',
         count(*), min(t.description)
  FROM public.transactions t
  JOIN public.chart_of_accounts a ON a.id = t.account_id
  WHERE t.company_id = p_company_id AND a.company_id <> t.company_id
  HAVING count(*) > 0;

  -- 5) Cadeia recebível → lançamento: título recebido que não virou receita.
  --    O caixa entrou e o DRE não viu. É o furo mais comum e o mais caro.
  RETURN QUERY
  SELECT 'erro', 'recebivel_sem_lancamento',
         'Recebível marcado como recebido sem lançamento de receita correspondente.',
         count(*), min(r.description)
  FROM public.receivables r
  WHERE r.company_id = p_company_id
    AND r.status = 'recebido'
    AND r.transaction_id IS NULL
  HAVING count(*) > 0;

  -- 6) Cadeia pedido → recebível: pedido faturado sem título gerado.
  RETURN QUERY
  SELECT 'alerta', 'pedido_faturado_sem_recebivel',
         'Pedido de venda faturado que não gerou recebível.',
         count(*), min('Pedido ' || so.order_number::text)
  FROM public.sales_orders so
  WHERE so.company_id = p_company_id
    AND so.status = 'invoiced'
    AND NOT EXISTS (SELECT 1 FROM public.receivables r WHERE r.sales_order_id = so.id)
  HAVING count(*) > 0;

  -- 7) Contrato ativo vencido sem cobrança gerada no período.
  RETURN QUERY
  SELECT 'alerta', 'contrato_sem_cobranca',
         'Contrato ativo com vencimento passado e nenhum recebível gerado.',
         count(*), min(c.description)
  FROM public.contracts c
  WHERE c.company_id = p_company_id
    AND c.status = 'active'
    AND c.next_due_date IS NOT NULL
    AND c.next_due_date < current_date
    AND NOT EXISTS (SELECT 1 FROM public.receivables r WHERE r.contract_id = c.id AND r.due_date >= c.next_due_date)
  HAVING count(*) > 0;

  -- 8) Lançamento confirmado sem classificação: entra no DRE como "a classificar"
  --    e distorce a leitura de margem por conta.
  RETURN QUERY
  SELECT 'alerta', 'lancamento_sem_conta',
         'Lançamento confirmado sem conta contábil: fica fora da análise por conta.',
         count(*), min(t.description)
  FROM public.transactions t
  WHERE t.company_id = p_company_id
    AND t.status IN ('confirmed','reconciled')
    AND t.account_id IS NULL
  HAVING count(*) > 0;

  -- 9) Competência ausente em regime de competência: o mês do resultado fica
  --    à mercê da data de caixa (fere o princípio da Competência).
  RETURN QUERY
  SELECT 'alerta', 'competencia_ausente',
         'Empresa em regime de competência com lançamentos sem data de competência.',
         count(*), min(t.description)
  FROM public.transactions t
  JOIN public.companies c ON c.id = t.company_id
  WHERE t.company_id = p_company_id
    AND coalesce(c.regime_apuracao,'caixa') = 'competencia'
    AND t.status IN ('confirmed','reconciled')
    AND t.competencia_date IS NULL
  HAVING count(*) > 0;

  -- 10) Mês fechado que recebeu lançamento depois do fechamento.
  RETURN QUERY
  SELECT 'erro', 'lancamento_em_mes_fechado',
         'Lançamento criado depois do fechamento do mês a que pertence.',
         count(*), min(t.description)
  FROM public.transactions t
  JOIN public.monthly_close mc
    ON mc.company_id = t.company_id
   AND mc.month = date_trunc('month', t.date)::date
  WHERE t.company_id = p_company_id
    AND mc.status = 'closed'
    AND t.created_at > mc.closed_at
  HAVING count(*) > 0;

  RETURN;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.auditar_integridade_contabil(uuid) TO authenticated;

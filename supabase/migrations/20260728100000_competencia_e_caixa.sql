-- Competência e caixa, as duas datas.
--
-- O conselho: "`transactions` tem uma data só. O dono decide por caixa, o
-- contador fecha por competência, e a apuração do Simples pode ser por qualquer
-- um dos dois. Com uma data só o produto não serve direito para nenhum."
--
-- `date` continua sendo a data de CAIXA, quando o dinheiro entrou ou saiu.
-- `competencia_date` é quando o fato aconteceu: o serviço prestado, a mercadoria
-- entregue, o aluguel do mês. Nulo significa "igual ao caixa", que é o caso da
-- maioria esmagadora e evita obrigar o usuário a preencher duas datas iguais.
--
-- A régua continua vivendo num lugar só. `v_dre_linhas` passa a devolver os
-- DOIS meses, e quem consulta escolhe a coluna conforme o regime da empresa.
-- Duas views seria duas cópias da mesma regra, que é o defeito que já corrigimos.

ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS competencia_date date;

COMMENT ON COLUMN public.transactions.competencia_date IS
  'Data do fato gerador. Nulo = mesma data do caixa.';

ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS regime_apuracao text NOT NULL DEFAULT 'caixa'
    CHECK (regime_apuracao IN ('caixa', 'competencia'));

COMMENT ON COLUMN public.companies.regime_apuracao IS
  'Como esta empresa lê o resultado: por caixa ou por competência.';

CREATE INDEX IF NOT EXISTS transactions_competencia_idx
  ON public.transactions (company_id, competencia_date)
  WHERE competencia_date IS NOT NULL;

-- CREATE OR REPLACE não aceita inserir coluna no meio da lista, então a view é
-- recriada. As funções que a consultam resolvem o nome em tempo de execução,
-- então o DROP não as invalida.
DROP VIEW IF EXISTS public.v_dre_linhas;
CREATE VIEW public.v_dre_linhas
WITH (security_invoker = on) AS
 SELECT
    t.company_id,
    -- Mês de caixa. Mantém o nome `mes` porque é o que as telas já consultam.
    date_trunc('month'::text, t.date::timestamp with time zone)::date AS mes,
    -- Mês de competência. Cai no caixa quando não houver data própria.
    date_trunc('month'::text, COALESCE(t.competencia_date, t.date)::timestamp with time zone)::date
      AS mes_competencia,
    t.account_id,
    coa.code AS account_code,
    coa.name AS account_name,
    t.type,
    t.is_intercompany,
    CASE
      WHEN coa.id IS NULL THEN 'a_classificar'::text
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
           t.account_id, coa.id, coa.code, coa.name, t.type, t.is_intercompany;

REVOKE ALL ON public.v_dre_linhas FROM anon;
GRANT SELECT ON public.v_dre_linhas TO authenticated;

-- `fechar_mes` passa a apurar pelo regime da empresa. Fechar por caixa uma
-- empresa que lê o resultado por competência congelaria um número que ela nunca
-- viu na tela.
CREATE OR REPLACE FUNCTION public.fechar_mes(p_company_id uuid, p_mes date)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_mes date := date_trunc('month', p_mes)::date;
  v_regime text;
  v_receita numeric := 0; v_custos numeric := 0; v_despesas numeric := 0;
  v_a_classificar numeric := 0; v_lancamentos bigint := 0; v_snapshot jsonb;
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
    COALESCE(sum(total) FILTER (WHERE grupo = 'custo'), 0),
    COALESCE(sum(total) FILTER (WHERE grupo = 'despesa'), 0),
    COALESCE(sum(total) FILTER (WHERE grupo = 'a_classificar'), 0),
    COALESCE(sum(lancamentos), 0)
  INTO v_receita, v_custos, v_despesas, v_a_classificar, v_lancamentos
  FROM public.v_dre_linhas
  WHERE company_id = p_company_id
    AND (CASE WHEN v_regime = 'competencia' THEN mes_competencia ELSE mes END) = v_mes;

  v_snapshot := jsonb_build_object(
    'receita', v_receita, 'custos', v_custos, 'despesas', v_despesas,
    'lucro_bruto', v_receita - v_custos,
    'lucro_liquido', v_receita - v_custos - v_despesas,
    'a_classificar', v_a_classificar, 'lancamentos', v_lancamentos,
    'regua', 'v_dre_linhas', 'regime', v_regime, 'apurado_em', now()
  );

  INSERT INTO public.monthly_close (company_id, month, status, snapshot, closed_at, closed_by)
  VALUES (p_company_id, v_mes, 'closed', v_snapshot, now(), auth.uid())
  ON CONFLICT (company_id, month) DO UPDATE
    SET status = 'closed', snapshot = v_snapshot, closed_at = now(), closed_by = auth.uid();

  RETURN v_snapshot;
END;
$$;

-- A trava do mês fechado passa a olhar as DUAS datas. Um lançamento de caixa em
-- mês aberto mas com competência em mês fechado muda o resultado já publicado
-- da empresa que apura por competência.
CREATE OR REPLACE FUNCTION public.bloquear_lancamento_em_mes_fechado()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_conta_antes boolean;
  v_conta_depois boolean;
  v_mudou_resultado boolean;
  v_data date;
BEGIN
  IF TG_OP = 'INSERT' THEN
    FOREACH v_data IN ARRAY ARRAY[NEW.date, COALESCE(NEW.competencia_date, NEW.date)] LOOP
      IF public.mes_esta_fechado(NEW.company_id, v_data) THEN
        RAISE EXCEPTION 'O mês % está fechado. Reabra o fechamento para lançar nesse período.',
          to_char(v_data, 'MM/YYYY') USING ERRCODE = '23514';
      END IF;
    END LOOP;
    RETURN NEW;
  END IF;

  IF TG_OP = 'DELETE' THEN
    FOREACH v_data IN ARRAY ARRAY[OLD.date, COALESCE(OLD.competencia_date, OLD.date)] LOOP
      IF public.mes_esta_fechado(OLD.company_id, v_data) THEN
        RAISE EXCEPTION 'O mês % está fechado. Reabra o fechamento para excluir lançamentos desse período.',
          to_char(v_data, 'MM/YYYY') USING ERRCODE = '23514';
      END IF;
    END LOOP;
    RETURN OLD;
  END IF;

  v_conta_antes  := OLD.status IN ('confirmed', 'reconciled');
  v_conta_depois := NEW.status IN ('confirmed', 'reconciled');

  v_mudou_resultado :=
       OLD.date              IS DISTINCT FROM NEW.date
    OR OLD.competencia_date  IS DISTINCT FROM NEW.competencia_date
    OR OLD.amount            IS DISTINCT FROM NEW.amount
    OR OLD.type              IS DISTINCT FROM NEW.type
    OR OLD.account_id        IS DISTINCT FROM NEW.account_id
    OR OLD.company_id        IS DISTINCT FROM NEW.company_id
    OR OLD.is_intercompany   IS DISTINCT FROM NEW.is_intercompany
    OR v_conta_antes         IS DISTINCT FROM v_conta_depois;

  IF NOT v_mudou_resultado THEN
    RETURN NEW;
  END IF;

  FOREACH v_data IN ARRAY ARRAY[OLD.date, COALESCE(OLD.competencia_date, OLD.date)] LOOP
    IF public.mes_esta_fechado(OLD.company_id, v_data) THEN
      RAISE EXCEPTION 'O mês % está fechado. Reabra o fechamento para alterar lançamentos desse período.',
        to_char(v_data, 'MM/YYYY') USING ERRCODE = '23514';
    END IF;
  END LOOP;

  FOREACH v_data IN ARRAY ARRAY[NEW.date, COALESCE(NEW.competencia_date, NEW.date)] LOOP
    IF public.mes_esta_fechado(NEW.company_id, v_data) THEN
      RAISE EXCEPTION 'O mês % está fechado. Não dá para jogar um lançamento para dentro de um período fechado.',
        to_char(v_data, 'MM/YYYY') USING ERRCODE = '23514';
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$;

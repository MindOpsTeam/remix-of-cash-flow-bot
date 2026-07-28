-- O fechamento mensal passa a fechar de verdade.
--
-- Hoje ele é um marco gerencial: a própria migration antiga admite que "não
-- bloqueia dados retroativos", e o snapshot grava CONTAGEM DE PENDÊNCIAS, não
-- os números do resultado. Ou seja, depois de fechado não havia como provar
-- qual era o lucro no momento do fechamento, e qualquer lançamento retroativo
-- mudava o passado em silêncio. Zero fechamentos em 131 empresas, o que faz
-- sentido: fechar não valia nada.
--
-- Duas mudanças, nesta ordem de importância:
--
--   1. TRAVA REAL. Gatilho em transactions que recusa mexer em mês fechado.
--   2. SNAPSHOT COM NÚMERO. Fechar passa a ser uma função que apura o
--      resultado pela mesma régua do DRE e grava junto, na mesma transação.
--      Não existe fechar sem registrar o número.

-- ── 1. A trava ────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.mes_esta_fechado(p_company_id uuid, p_data date)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.monthly_close mc
     WHERE mc.company_id = p_company_id
       AND mc.status = 'closed'
       AND mc.month = date_trunc('month', p_data)::date
  );
$$;

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
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF public.mes_esta_fechado(NEW.company_id, NEW.date) THEN
      RAISE EXCEPTION 'O mês % está fechado. Reabra o fechamento para lançar nesse período.',
        to_char(NEW.date, 'MM/YYYY') USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'DELETE' THEN
    IF public.mes_esta_fechado(OLD.company_id, OLD.date) THEN
      RAISE EXCEPTION 'O mês % está fechado. Reabra o fechamento para excluir lançamentos desse período.',
        to_char(OLD.date, 'MM/YYYY') USING ERRCODE = '23514';
    END IF;
    RETURN OLD;
  END IF;

  -- UPDATE. Não se trava qualquer edição: anexar comprovante ou corrigir a
  -- descrição de um lançamento antigo é trabalho legítimo e não mexe em número
  -- nenhum. Trava-se o que MUDA O RESULTADO já publicado.
  v_conta_antes  := OLD.status IN ('confirmed', 'reconciled');
  v_conta_depois := NEW.status IN ('confirmed', 'reconciled');

  v_mudou_resultado :=
       OLD.date            IS DISTINCT FROM NEW.date
    OR OLD.amount          IS DISTINCT FROM NEW.amount
    OR OLD.type            IS DISTINCT FROM NEW.type
    OR OLD.account_id      IS DISTINCT FROM NEW.account_id
    OR OLD.company_id      IS DISTINCT FROM NEW.company_id
    OR OLD.is_intercompany IS DISTINCT FROM NEW.is_intercompany
    OR v_conta_antes       IS DISTINCT FROM v_conta_depois;

  IF NOT v_mudou_resultado THEN
    RETURN NEW;
  END IF;

  -- Vale para o mês de ONDE saiu e para o mês PARA ONDE vai: mover um
  -- lançamento para fora de um mês fechado burla o fechamento igualzinho.
  IF public.mes_esta_fechado(OLD.company_id, OLD.date) THEN
    RAISE EXCEPTION 'O mês % está fechado. Reabra o fechamento para alterar lançamentos desse período.',
      to_char(OLD.date, 'MM/YYYY') USING ERRCODE = '23514';
  END IF;

  IF public.mes_esta_fechado(NEW.company_id, NEW.date) THEN
    RAISE EXCEPTION 'O mês % está fechado. Não dá para jogar um lançamento para dentro de um período fechado.',
      to_char(NEW.date, 'MM/YYYY') USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_bloquear_mes_fechado ON public.transactions;
CREATE TRIGGER trg_bloquear_mes_fechado
  BEFORE INSERT OR UPDATE OR DELETE ON public.transactions
  FOR EACH ROW EXECUTE FUNCTION public.bloquear_lancamento_em_mes_fechado();

-- ── 2. Fechar apurando ────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.fechar_mes(p_company_id uuid, p_mes date)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_mes date := date_trunc('month', p_mes)::date;
  v_receita numeric := 0;
  v_custos numeric := 0;
  v_despesas numeric := 0;
  v_a_classificar numeric := 0;
  v_lancamentos bigint := 0;
  v_snapshot jsonb;
BEGIN
  -- A função é SECURITY DEFINER e por isso a RLS não protege o que vem abaixo.
  -- A checagem de acesso é explícita, e é a primeira coisa que roda.
  IF NOT public.is_company_member(p_company_id) THEN
    RAISE EXCEPTION 'Sem acesso a esta empresa.' USING ERRCODE = '42501';
  END IF;

  IF v_mes > date_trunc('month', now())::date THEN
    RAISE EXCEPTION 'Não dá para fechar um mês que ainda não começou.' USING ERRCODE = '23514';
  END IF;

  SELECT
    COALESCE(sum(total) FILTER (WHERE grupo = 'receita'), 0),
    COALESCE(sum(total) FILTER (WHERE grupo = 'custo'), 0),
    COALESCE(sum(total) FILTER (WHERE grupo = 'despesa'), 0),
    COALESCE(sum(total) FILTER (WHERE grupo = 'a_classificar'), 0),
    COALESCE(sum(lancamentos), 0)
  INTO v_receita, v_custos, v_despesas, v_a_classificar, v_lancamentos
  FROM public.v_dre_linhas
  WHERE company_id = p_company_id AND mes = v_mes;

  -- O snapshot guarda o RESULTADO, não a contagem de pendências. É isso que
  -- permite, meses depois, provar qual era o lucro quando o mês foi fechado, e
  -- comparar com o que a tela mostra hoje.
  v_snapshot := jsonb_build_object(
    'receita', v_receita,
    'custos', v_custos,
    'despesas', v_despesas,
    'lucro_bruto', v_receita - v_custos,
    'lucro_liquido', v_receita - v_custos - v_despesas,
    'a_classificar', v_a_classificar,
    'lancamentos', v_lancamentos,
    'regua', 'v_dre_linhas',
    'apurado_em', now()
  );

  INSERT INTO public.monthly_close (company_id, month, status, snapshot, closed_at, closed_by)
  VALUES (p_company_id, v_mes, 'closed', v_snapshot, now(), auth.uid())
  ON CONFLICT (company_id, month) DO UPDATE
    SET status = 'closed', snapshot = v_snapshot, closed_at = now(), closed_by = auth.uid();

  RETURN v_snapshot;
END;
$$;

CREATE OR REPLACE FUNCTION public.reabrir_mes(p_company_id uuid, p_mes date, p_motivo text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_mes date := date_trunc('month', p_mes)::date;
BEGIN
  IF NOT public.is_company_member(p_company_id) THEN
    RAISE EXCEPTION 'Sem acesso a esta empresa.' USING ERRCODE = '42501';
  END IF;

  IF coalesce(trim(p_motivo), '') = '' THEN
    RAISE EXCEPTION 'Reabrir um mês fechado exige motivo.' USING ERRCODE = '23514';
  END IF;

  -- Reabrir não apaga o snapshot: ele é a prova do que estava fechado. O
  -- histórico de reaberturas fica junto, para o contador ver quantas vezes o
  -- período foi mexido depois de publicado.
  UPDATE public.monthly_close
     SET status = 'open',
         snapshot = coalesce(snapshot, '{}'::jsonb) || jsonb_build_object(
           'reaberturas',
           coalesce(snapshot -> 'reaberturas', '[]'::jsonb) || jsonb_build_array(
             jsonb_build_object('em', now(), 'por', auth.uid(), 'motivo', trim(p_motivo))
           )
         )
   WHERE company_id = p_company_id AND month = v_mes;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Não existe fechamento para este mês.' USING ERRCODE = '23514';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.fechar_mes(uuid, date) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.reabrir_mes(uuid, date, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fechar_mes(uuid, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reabrir_mes(uuid, date, text) TO authenticated;

COMMENT ON FUNCTION public.fechar_mes(uuid, date) IS
  'Fecha o mês apurando o resultado pela régua de v_dre_linhas e gravando os números no snapshot. Único caminho para fechar.';
COMMENT ON FUNCTION public.reabrir_mes(uuid, date, text) IS
  'Reabre um mês fechado. Exige motivo e mantém o snapshot anterior mais o histórico de reaberturas.';

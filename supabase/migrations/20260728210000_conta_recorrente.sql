-- Conta a pagar recorrente.
--
-- As colunas `is_recurring`, `recurrence_group_id`, `recurrence_index` e
-- `recurrence_total` existem em `bills_payable` desde o commit dd3f778, e o
-- Lovable reverteu a TELA no commit e0868ac sem tirar as colunas. Resultado:
-- schema prometendo um recurso que não existia, zero linhas usando, e nenhuma
-- tela referenciando. Coluna órfã é pior que coluna faltando, porque quem lê o
-- schema acredita nela.
--
-- Decisão: restaurar a função, não apagar as colunas. Aluguel, contador,
-- software e seguro são a espinha do contas a pagar de PME, e hoje o dono
-- relança tudo à mão todo mês, que é o tipo de trabalho que faz ele parar de
-- usar o sistema.
--
-- Simetria proposital: `contracts` já faz exatamente isto do lado do RECEBER,
-- via contracts-billing. Aqui é o mesmo desenho do lado do PAGAR.

/**
 * Gera as ocorrências futuras de uma conta, ligadas pelo mesmo grupo.
 *
 * Gera TUDO de uma vez, e não sob demanda mensal, de propósito: conta a pagar
 * conhecida precisa aparecer no fluxo de caixa projetado. Recorrência que só
 * materializa no mês corrente esconde do dono um compromisso que ele já tem.
 *
 * A alçada de aprovação é respeitada em cada parcela, e não só na primeira: um
 * contrato anual dividido em doze pode ter parcela abaixo do limite mas
 * compromisso total bem acima, e é o valor da parcela que vira saída de caixa.
 */
CREATE OR REPLACE FUNCTION public.gerar_conta_recorrente(
  p_bill_id uuid,
  p_ocorrencias integer,
  p_periodicidade text DEFAULT 'mensal'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_b record;
  v_total integer := greatest(2, least(coalesce(p_ocorrencias, 12), 60));
  v_intervalo interval;
  v_grupo uuid;
  v_i integer;
  v_venc date;
  v_criadas integer := 0;
BEGIN
  SELECT * INTO v_b FROM public.bills_payable WHERE id = p_bill_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Conta não encontrada.' USING ERRCODE = '23503';
  END IF;
  IF NOT public.is_company_member(v_b.company_id) THEN
    RAISE EXCEPTION 'Sem acesso a esta empresa.' USING ERRCODE = '42501';
  END IF;
  IF v_b.recurrence_group_id IS NOT NULL THEN
    RAISE EXCEPTION 'Esta conta já faz parte de uma recorrência.' USING ERRCODE = '23505';
  END IF;

  v_intervalo := CASE p_periodicidade
    WHEN 'semanal'    THEN interval '7 days'
    WHEN 'quinzenal'  THEN interval '15 days'
    WHEN 'mensal'     THEN interval '1 month'
    WHEN 'bimestral'  THEN interval '2 months'
    WHEN 'trimestral' THEN interval '3 months'
    WHEN 'semestral'  THEN interval '6 months'
    WHEN 'anual'      THEN interval '1 year'
    ELSE NULL
  END;

  IF v_intervalo IS NULL THEN
    RAISE EXCEPTION 'Periodicidade inválida: %.', p_periodicidade USING ERRCODE = '23514';
  END IF;

  -- Qualificado: pgcrypto mora no schema `extensions` no Supabase e o
  -- search_path desta função é só `public`, de propósito.
  v_grupo := extensions.gen_random_uuid();

  -- A conta original vira a primeira do grupo, em vez de virar duplicata.
  UPDATE public.bills_payable
     SET is_recurring = true,
         recurrence_group_id = v_grupo,
         recurrence_index = 1,
         recurrence_total = v_total,
         updated_at = now()
   WHERE id = p_bill_id;

  FOR v_i IN 2..v_total LOOP
    -- `+ interval '1 month'` sobre dia 31 cai no último dia do mês seguinte,
    -- que é o comportamento certo para vencimento: aluguel do dia 31 vence dia
    -- 28 em fevereiro, não dia 3 de março.
    v_venc := (v_b.vencimento + (v_intervalo * (v_i - 1)))::date;

    INSERT INTO public.bills_payable
      (company_id, fornecedor, descricao, valor, vencimento, status, source,
       contact_id, approval_status, requested_by,
       is_recurring, recurrence_group_id, recurrence_index, recurrence_total)
    VALUES
      (v_b.company_id, v_b.fornecedor, v_b.descricao, v_b.valor, v_venc, 'pending',
       coalesce(v_b.source, 'manual'), v_b.contact_id,
       v_b.approval_status, v_b.requested_by,
       true, v_grupo, v_i, v_total);

    v_criadas := v_criadas + 1;
  END LOOP;

  RETURN jsonb_build_object(
    'grupo', v_grupo,
    'criadas', v_criadas,
    'total_no_grupo', v_total,
    'ultimo_vencimento', (v_b.vencimento + (v_intervalo * (v_total - 1)))::date
  );
END;
$$;

REVOKE ALL ON FUNCTION public.gerar_conta_recorrente(uuid, integer, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.gerar_conta_recorrente(uuid, integer, text) TO authenticated;

COMMENT ON FUNCTION public.gerar_conta_recorrente(uuid, integer, text) IS
  'Transforma uma conta em recorrência, gerando as ocorrências futuras no mesmo grupo. Respeita a alçada de aprovação em cada parcela.';

/**
 * Cancela as ocorrências FUTURAS de uma recorrência, preservando o passado.
 *
 * Apagar o grupo inteiro seria apagar histórico de conta já paga. O que se
 * cancela é o que ainda não venceu e ainda não foi pago.
 */
CREATE OR REPLACE FUNCTION public.encerrar_recorrencia(p_recurrence_group_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_company uuid;
  v_removidas integer;
BEGIN
  SELECT company_id INTO v_company FROM public.bills_payable
   WHERE recurrence_group_id = p_recurrence_group_id LIMIT 1;
  IF v_company IS NULL THEN
    RAISE EXCEPTION 'Recorrência não encontrada.' USING ERRCODE = '23503';
  END IF;
  IF NOT public.is_company_member(v_company) THEN
    RAISE EXCEPTION 'Sem acesso a esta empresa.' USING ERRCODE = '42501';
  END IF;

  DELETE FROM public.bills_payable
   WHERE recurrence_group_id = p_recurrence_group_id
     AND status = 'pending'
     AND vencimento > current_date;
  GET DIAGNOSTICS v_removidas = ROW_COUNT;

  RETURN jsonb_build_object('canceladas', v_removidas);
END;
$$;

REVOKE ALL ON FUNCTION public.encerrar_recorrencia(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.encerrar_recorrencia(uuid) TO authenticated;

CREATE INDEX IF NOT EXISTS bills_payable_recurrence_idx
  ON public.bills_payable (recurrence_group_id, recurrence_index)
  WHERE recurrence_group_id IS NOT NULL;

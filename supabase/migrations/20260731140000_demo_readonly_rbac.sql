-- Fecha o buraco provado na revisão da demonstração: a conta demo (viewer,
-- senha PÚBLICA) conseguia mutar o palco compartilhado e poluir a base porque
-- várias RPCs SECURITY DEFINER só checavam membresia, nunca o papel. RLS
-- protege a escrita DIRETA (PostgREST), mas SECURITY DEFINER bypassa RLS.
--
-- Duas frentes:
--  1) RPCs de escrita por empresa passam a exigir pode_escrever_na_empresa
--     (admin|member). Base real é 100% admin → zero impacto; só viewer barrado.
--  2) create_company_for_user e aceitar_convite não são escrita "por empresa"
--     (criam/entram em org), então ganham bloqueio EXPLÍCITO da conta demo.

-- Helper: a conta de demonstração compartilhada.
CREATE OR REPLACE FUNCTION public.is_demo_account()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM auth.users
     WHERE id = auth.uid() AND email = 'demo@financeai.app'
  );
$function$;

-- ── fechar_mes: + guard de papel ───────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.fechar_mes(p_company_id uuid, p_mes date)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_mes date := date_trunc('month', p_mes)::date; v_regime text;
  v_receita numeric := 0; v_deducoes numeric := 0; v_custos numeric := 0;
  v_despesas numeric := 0; v_a_classificar numeric := 0;
  v_lancamentos bigint := 0; v_snapshot jsonb;
BEGIN
  IF NOT public.is_company_member(p_company_id) THEN
    RAISE EXCEPTION 'Sem acesso a esta empresa.' USING ERRCODE='42501'; END IF;
  IF NOT public.pode_escrever_na_empresa(p_company_id) THEN
    RAISE EXCEPTION 'Seu perfil é somente leitura nesta empresa.' USING ERRCODE='42501'; END IF;
  IF v_mes > date_trunc('month', now())::date THEN
    RAISE EXCEPTION 'Nao da para fechar um mes que ainda nao comecou.' USING ERRCODE='23514'; END IF;

  SELECT COALESCE(regime_apuracao,'caixa') INTO v_regime FROM public.companies WHERE id = p_company_id;

  SELECT COALESCE(sum(total) FILTER (WHERE grupo='receita'),0),
         COALESCE(sum(total) FILTER (WHERE grupo='deducao'),0),
         COALESCE(sum(total) FILTER (WHERE grupo='custo'),0),
         COALESCE(sum(total) FILTER (WHERE grupo='despesa'),0),
         COALESCE(sum(total) FILTER (WHERE grupo='a_classificar'),0),
         COALESCE(sum(lancamentos),0)
    INTO v_receita, v_deducoes, v_custos, v_despesas, v_a_classificar, v_lancamentos
    FROM public.v_dre_linhas
   WHERE company_id = p_company_id
     AND (CASE WHEN v_regime='competencia' THEN mes_competencia ELSE mes END) = v_mes;

  v_snapshot := jsonb_build_object(
    'receita', v_receita, 'deducoes', v_deducoes,
    'receita_liquida', v_receita - v_deducoes,
    'custos', v_custos, 'despesas', v_despesas,
    'lucro_bruto', v_receita - v_deducoes - v_custos,
    'lucro_liquido', v_receita - v_deducoes - v_custos - v_despesas,
    'a_classificar', v_a_classificar, 'lancamentos', v_lancamentos,
    'regua','v_dre_linhas','regime',v_regime,'apurado_em',now());

  INSERT INTO public.monthly_close (company_id, month, status, snapshot, closed_at, closed_by)
  VALUES (p_company_id, v_mes, 'closed', v_snapshot, now(), auth.uid())
  ON CONFLICT (company_id, month) DO UPDATE
    SET status='closed', snapshot=v_snapshot, closed_at=now(), closed_by=auth.uid();
  RETURN v_snapshot;
END; $function$;

-- ── reabrir_mes: + guard de papel ──────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.reabrir_mes(p_company_id uuid, p_mes date, p_motivo text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_mes date := date_trunc('month', p_mes)::date;
BEGIN
  IF NOT public.is_company_member(p_company_id) THEN
    RAISE EXCEPTION 'Sem acesso a esta empresa.' USING ERRCODE = '42501';
  END IF;
  IF NOT public.pode_escrever_na_empresa(p_company_id) THEN
    RAISE EXCEPTION 'Seu perfil é somente leitura nesta empresa.' USING ERRCODE = '42501';
  END IF;
  IF coalesce(trim(p_motivo), '') = '' THEN
    RAISE EXCEPTION 'Reabrir um mes fechado exige motivo.' USING ERRCODE = '23514';
  END IF;

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
    RAISE EXCEPTION 'Nao existe fechamento para este mes.' USING ERRCODE = '23514';
  END IF;
END;
$function$;

-- ── faturar_pedido: + guard de papel ───────────────────────────────────────
CREATE OR REPLACE FUNCTION public.faturar_pedido(p_sales_order_id uuid, p_parcelas integer DEFAULT 1, p_primeiro_vencimento date DEFAULT NULL::date, p_intervalo_dias integer DEFAULT 30)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_pedido record;
  v_parcelas integer := greatest(1, least(coalesce(p_parcelas,1), 36));
  v_intervalo integer := greatest(1, least(coalesce(p_intervalo_dias,30), 365));
  v_base date; v_valor_parcela numeric; v_resto numeric; v_valor numeric;
  v_venc date; v_i integer; v_criados integer := 0; v_ids uuid[] := '{}'; v_id uuid;
  v_limite numeric; v_em_aberto numeric := 0; v_alerta text := NULL;
BEGIN
  SELECT * INTO v_pedido FROM public.sales_orders WHERE id = p_sales_order_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Pedido nao encontrado.' USING ERRCODE='23503'; END IF;
  IF NOT public.is_company_member(v_pedido.company_id) THEN
    RAISE EXCEPTION 'Sem acesso a esta empresa.' USING ERRCODE='42501'; END IF;
  IF NOT public.pode_escrever_na_empresa(v_pedido.company_id) THEN
    RAISE EXCEPTION 'Seu perfil é somente leitura nesta empresa.' USING ERRCODE='42501'; END IF;
  IF v_pedido.status = 'cancelled' THEN
    RAISE EXCEPTION 'Pedido cancelado nao pode ser faturado.' USING ERRCODE='23514'; END IF;
  IF coalesce(v_pedido.total,0) <= 0 THEN
    RAISE EXCEPTION 'Pedido sem valor nao gera recebivel.' USING ERRCODE='23514'; END IF;
  IF EXISTS (SELECT 1 FROM public.receivables WHERE sales_order_id = p_sales_order_id) THEN
    RAISE EXCEPTION 'Este pedido ja foi faturado.' USING ERRCODE='23505'; END IF;

  IF v_pedido.contact_id IS NOT NULL THEN
    SELECT credit_limit INTO v_limite FROM public.contacts WHERE id = v_pedido.contact_id;
    IF COALESCE(v_limite,0) > 0 THEN
      SELECT COALESCE(sum(amount),0) INTO v_em_aberto FROM public.receivables
       WHERE contact_id = v_pedido.contact_id AND status IN ('a_receber','vencido');
      IF v_em_aberto + v_pedido.total > v_limite THEN
        v_alerta := format('Este faturamento leva o cliente a %s em aberto, acima do limite de %s.',
          public.brl(v_em_aberto + v_pedido.total), public.brl(v_limite));
      END IF;
    END IF;
  END IF;

  v_base := coalesce(p_primeiro_vencimento, v_pedido.due_date, current_date);
  v_valor_parcela := trunc((v_pedido.total / v_parcelas)::numeric, 2);
  v_resto := round(v_pedido.total - (v_valor_parcela * v_parcelas), 2);

  FOR v_i IN 1..v_parcelas LOOP
    v_valor := v_valor_parcela + CASE WHEN v_i = 1 THEN v_resto ELSE 0 END;
    v_venc := v_base + ((v_i - 1) * v_intervalo);
    INSERT INTO public.receivables (company_id, contact_id, sales_order_id, description, amount,
      due_date, status, source, parcela, parcelas_total)
    VALUES (v_pedido.company_id, v_pedido.contact_id, p_sales_order_id,
      'Pedido ' || v_pedido.order_number ||
        CASE WHEN v_parcelas > 1 THEN ' (' || v_i || '/' || v_parcelas || ')' ELSE '' END,
      v_valor, v_venc, 'a_receber', 'pedido', v_i, v_parcelas)
    RETURNING id INTO v_id;
    v_ids := v_ids || v_id; v_criados := v_criados + 1;
  END LOOP;

  UPDATE public.sales_orders SET status='invoiced', updated_at=now() WHERE id = p_sales_order_id;
  RETURN jsonb_build_object('recebiveis_criados', v_criados, 'ids', to_jsonb(v_ids),
    'total', v_pedido.total, 'primeiro_vencimento', v_base, 'alerta_credito', v_alerta);
END; $function$;

-- ── registrar_movimento_estoque: + guard de papel ──────────────────────────
CREATE OR REPLACE FUNCTION public.registrar_movimento_estoque(p_company_id uuid, p_product_id uuid, p_tipo text, p_quantidade numeric, p_custo_unitario numeric DEFAULT NULL::numeric, p_observacao text DEFAULT NULL::text, p_warehouse_id uuid DEFAULT NULL::uuid, p_reference_type text DEFAULT 'manual'::text, p_reference_id uuid DEFAULT NULL::uuid)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_saldo numeric; v_custo numeric; v_cadastro numeric; v_delta numeric;
  v_novo numeric; v_novo_custo numeric; v_deposito uuid; v_user uuid := auth.uid();
begin
  if not public.is_company_member(p_company_id) then raise exception 'Sem permissao nesta empresa'; end if;
  if not public.pode_escrever_na_empresa(p_company_id) then
    raise exception 'Seu perfil é somente leitura nesta empresa.' using errcode='42501'; end if;
  if p_tipo not in ('in','out','adjustment') then raise exception 'Tipo de movimento invalido: %', p_tipo; end if;
  select current_stock, average_cost, cost_price into v_saldo, v_custo, v_cadastro
    from public.products where id = p_product_id and company_id = p_company_id for update;
  if not found then raise exception 'Produto nao encontrado nesta empresa'; end if;
  v_saldo := coalesce(v_saldo, 0);
  v_custo := coalesce(v_custo, v_cadastro);
  if p_tipo = 'in' then v_delta := abs(p_quantidade);
  elsif p_tipo = 'out' then v_delta := -abs(p_quantidade);
  else v_delta := p_quantidade - v_saldo; end if;
  v_novo := v_saldo + v_delta;
  if p_tipo = 'out' and v_novo < 0 then
    raise exception 'Estoque insuficiente: disponivel %, saida %', v_saldo, abs(p_quantidade); end if;
  if p_tipo = 'in' and p_custo_unitario is not null and v_novo > 0 then
    v_novo_custo := round(((greatest(v_saldo,0) * coalesce(v_custo, p_custo_unitario)) + (v_delta * p_custo_unitario)) / v_novo, 6);
  else v_novo_custo := v_custo; end if;
  if p_warehouse_id is not null then v_deposito := p_warehouse_id;
  else
    select id into v_deposito from public.warehouses where company_id = p_company_id limit 1;
    if v_deposito is null then
      insert into public.warehouses (company_id, name) values (p_company_id, 'Deposito principal') returning id into v_deposito;
    end if;
  end if;
  insert into public.stock_movements (company_id, product_id, warehouse_id, type, quantity, unit_cost, notes, user_id, reference_type, reference_id)
  values (p_company_id, p_product_id, v_deposito, p_tipo, v_delta, p_custo_unitario, p_observacao, v_user,
          coalesce(p_reference_type,'manual'), p_reference_id);
  update public.products set current_stock = v_novo, average_cost = v_novo_custo where id = p_product_id;
  return json_build_object('saldo_anterior', v_saldo, 'delta', v_delta, 'saldo_novo', v_novo, 'custo_medio', v_novo_custo);
end; $function$;

-- ── create_company_for_user: bloqueia a conta demo ─────────────────────────
CREATE OR REPLACE FUNCTION public.create_company_for_user(company_name text, company_cnpj text DEFAULT NULL::text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  new_company_id uuid;
  n_companies int;
  clean_cnpj text;
  result json;
begin
  if public.is_demo_account() then
    raise exception 'A conta de demonstração não pode criar empresas.' using errcode = '42501';
  end if;

  select count(*) into n_companies from company_members where user_id = auth.uid();
  if n_companies >= 6 then
    raise exception 'Limite de 6 empresas (CNPJs) atingido para este cliente';
  end if;

  clean_cnpj := nullif(regexp_replace(coalesce(company_cnpj, ''), '\D', '', 'g'), '');

  insert into companies (name, cnpj) values (company_name, clean_cnpj)
  returning id into new_company_id;

  insert into company_members (company_id, user_id, role)
  values (new_company_id, auth.uid(), 'admin');

  select json_build_object('id', c.id, 'name', c.name, 'cnpj', c.cnpj, 'org_id', c.org_id)
    into result from companies c where c.id = new_company_id;
  return result;
end;
$function$;

-- ── aceitar_convite: bloqueia a conta demo ─────────────────────────────────
CREATE OR REPLACE FUNCTION public.aceitar_convite(p_token uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_convite record;
  v_empresa text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Entre na sua conta para aceitar o convite.' USING ERRCODE = '42501';
  END IF;
  IF public.is_demo_account() THEN
    RAISE EXCEPTION 'A conta de demonstração não pode entrar em empresas reais.' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_convite FROM public.company_invites
   WHERE token = p_token
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Convite não encontrado.' USING ERRCODE = '23514';
  END IF;
  IF v_convite.usado_em IS NOT NULL THEN
    RAISE EXCEPTION 'Este convite já foi usado.' USING ERRCODE = '23514';
  END IF;
  IF v_convite.expira_em < now() THEN
    RAISE EXCEPTION 'Este convite expirou. Peça um novo ao administrador.' USING ERRCODE = '23514';
  END IF;

  IF EXISTS (SELECT 1 FROM public.company_members WHERE company_id = v_convite.company_id AND user_id = auth.uid()) THEN
    SELECT name INTO v_empresa FROM public.companies WHERE id = v_convite.company_id;
    RETURN jsonb_build_object('ok', true, 'ja_era_membro', true, 'empresa', v_empresa);
  END IF;

  INSERT INTO public.company_members (company_id, user_id, role, onboarding_completed)
  VALUES (v_convite.company_id, auth.uid(), v_convite.role, true);

  UPDATE public.company_invites
     SET usado_por = auth.uid(), usado_em = now()
   WHERE id = v_convite.id;

  SELECT name INTO v_empresa FROM public.companies WHERE id = v_convite.company_id;
  RETURN jsonb_build_object('ok', true, 'ja_era_membro', false, 'empresa', v_empresa, 'role', v_convite.role);
END;
$function$;

-- ── auth.users: conta demo não troca senha/e-mail/telefone ─────────────────
-- Sem isso, um visitante logado como demo faz supabase.auth.updateUser(...) no
-- console e derruba a demo pública para todo mundo. O GoTrue faz UPDATE direto
-- em auth.users, então um BEFORE UPDATE aqui pega. Só bloqueia mudança dessas
-- credenciais; last_sign_in_at/metadata do login normal passam.
CREATE OR REPLACE FUNCTION public.protege_conta_demo()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF OLD.email = 'demo@financeai.app' THEN
    IF NEW.encrypted_password IS DISTINCT FROM OLD.encrypted_password
       OR NEW.email IS DISTINCT FROM OLD.email
       OR NEW.phone IS DISTINCT FROM OLD.phone THEN
      RAISE EXCEPTION 'A conta de demonstração é somente leitura e não pode ter credenciais alteradas.'
        USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_protege_conta_demo ON auth.users;
CREATE TRIGGER trg_protege_conta_demo
  BEFORE UPDATE ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.protege_conta_demo();

-- ── Demais RPCs SECURITY DEFINER de escrita: + guard pode_escrever ──────────
CREATE OR REPLACE FUNCTION public.encerrar_recorrencia(p_recurrence_group_id uuid)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_company uuid; v_removidas integer;
BEGIN
  SELECT company_id INTO v_company FROM public.bills_payable
   WHERE recurrence_group_id = p_recurrence_group_id LIMIT 1;
  IF v_company IS NULL THEN RAISE EXCEPTION 'Recorrencia nao encontrada.' USING ERRCODE='23503'; END IF;
  IF NOT public.is_company_member(v_company) THEN
    RAISE EXCEPTION 'Sem acesso a esta empresa.' USING ERRCODE='42501'; END IF;
  IF NOT public.pode_escrever_na_empresa(v_company) THEN
    RAISE EXCEPTION 'Seu perfil é somente leitura nesta empresa.' USING ERRCODE='42501'; END IF;
  DELETE FROM public.bills_payable
   WHERE recurrence_group_id = p_recurrence_group_id AND status = 'pending' AND vencimento > current_date;
  GET DIAGNOSTICS v_removidas = ROW_COUNT;
  RETURN jsonb_build_object('canceladas', v_removidas);
END; $function$;

CREATE OR REPLACE FUNCTION public.fechar_comissao(p_company_id uuid, p_mes date, p_vencimento date DEFAULT NULL::date)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_mes date := date_trunc('month', p_mes)::date;
  v_venc date := COALESCE(p_vencimento, (date_trunc('month', p_mes) + interval '1 month' + interval '9 days')::date);
  v_criadas integer := 0; v_total numeric := 0; r record;
BEGIN
  IF NOT public.is_company_member(p_company_id) THEN
    RAISE EXCEPTION 'Sem acesso a esta empresa.' USING ERRCODE='42501'; END IF;
  IF NOT public.pode_escrever_na_empresa(p_company_id) THEN
    RAISE EXCEPTION 'Seu perfil é somente leitura nesta empresa.' USING ERRCODE='42501'; END IF;
  FOR r IN SELECT v.salesperson_id, v.vendedor, v.comissao FROM public.v_meta_vendedor v
            WHERE v.company_id = p_company_id AND v.mes = v_mes
              AND v.salesperson_id IS NOT NULL AND v.comissao > 0 LOOP
    IF EXISTS (SELECT 1 FROM public.bills_payable b WHERE b.company_id = p_company_id
                AND b.descricao = format('Comissao %s - %s', r.vendedor, to_char(v_mes,'MM/YYYY'))) THEN
      CONTINUE; END IF;
    INSERT INTO public.bills_payable (company_id, fornecedor, descricao, valor, vencimento, status, source, approval_status)
    VALUES (p_company_id, r.vendedor, format('Comissao %s - %s', r.vendedor, to_char(v_mes,'MM/YYYY')),
            round(r.comissao,2), v_venc, 'pending', 'comissao', 'approved');
    v_criadas := v_criadas + 1; v_total := v_total + round(r.comissao,2);
  END LOOP;
  RETURN jsonb_build_object('contas_criadas', v_criadas, 'total', v_total, 'vencimento', v_venc);
END; $function$;

CREATE OR REPLACE FUNCTION public.gerar_conta_recorrente(p_bill_id uuid, p_ocorrencias integer, p_periodicidade text DEFAULT 'mensal'::text)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_b record; v_total integer := greatest(2, least(coalesce(p_ocorrencias,12), 60));
  v_intervalo interval; v_grupo uuid; v_i integer; v_venc date; v_criadas integer := 0;
BEGIN
  SELECT * INTO v_b FROM public.bills_payable WHERE id = p_bill_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Conta nao encontrada.' USING ERRCODE='23503'; END IF;
  IF NOT public.is_company_member(v_b.company_id) THEN
    RAISE EXCEPTION 'Sem acesso a esta empresa.' USING ERRCODE='42501'; END IF;
  IF NOT public.pode_escrever_na_empresa(v_b.company_id) THEN
    RAISE EXCEPTION 'Seu perfil é somente leitura nesta empresa.' USING ERRCODE='42501'; END IF;
  IF v_b.recurrence_group_id IS NOT NULL THEN
    RAISE EXCEPTION 'Esta conta ja faz parte de uma recorrencia.' USING ERRCODE='23505'; END IF;

  v_intervalo := CASE p_periodicidade
    WHEN 'semanal' THEN interval '7 days' WHEN 'quinzenal' THEN interval '15 days'
    WHEN 'mensal' THEN interval '1 month' WHEN 'bimestral' THEN interval '2 months'
    WHEN 'trimestral' THEN interval '3 months' WHEN 'semestral' THEN interval '6 months'
    WHEN 'anual' THEN interval '1 year' ELSE NULL END;
  IF v_intervalo IS NULL THEN
    RAISE EXCEPTION 'Periodicidade invalida: %.', p_periodicidade USING ERRCODE='23514'; END IF;

  v_grupo := extensions.gen_random_uuid();

  UPDATE public.bills_payable
     SET is_recurring = true, recurrence_group_id = v_grupo,
         recurrence_index = 1, recurrence_total = v_total, updated_at = now()
   WHERE id = p_bill_id;

  FOR v_i IN 2..v_total LOOP
    v_venc := (v_b.vencimento + (v_intervalo * (v_i - 1)))::date;
    INSERT INTO public.bills_payable
      (company_id, fornecedor, descricao, valor, vencimento, status, source,
       contact_id, approval_status, requested_by,
       is_recurring, recurrence_group_id, recurrence_index, recurrence_total)
    VALUES (v_b.company_id, v_b.fornecedor, v_b.descricao, v_b.valor, v_venc, 'pending',
       coalesce(v_b.source,'manual'), v_b.contact_id, v_b.approval_status, v_b.requested_by,
       true, v_grupo, v_i, v_total);
    v_criadas := v_criadas + 1;
  END LOOP;

  RETURN jsonb_build_object('grupo', v_grupo, 'criadas', v_criadas, 'total_no_grupo', v_total,
    'ultimo_vencimento', (v_b.vencimento + (v_intervalo * (v_total - 1)))::date);
END; $function$;

CREATE OR REPLACE FUNCTION public.gerar_link_proposta(p_sales_order_id uuid, p_dias_validade integer DEFAULT 15)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_pedido record; v_token text; v_validade date;
BEGIN
  SELECT * INTO v_pedido FROM public.sales_orders WHERE id = p_sales_order_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Pedido nao encontrado.' USING ERRCODE='23503'; END IF;
  IF NOT public.is_company_member(v_pedido.company_id) THEN
    RAISE EXCEPTION 'Sem acesso a esta empresa.' USING ERRCODE='42501'; END IF;
  IF NOT public.pode_escrever_na_empresa(v_pedido.company_id) THEN
    RAISE EXCEPTION 'Seu perfil é somente leitura nesta empresa.' USING ERRCODE='42501'; END IF;
  IF v_pedido.aceite_em IS NOT NULL THEN
    RAISE EXCEPTION 'Esta proposta ja foi aceita.' USING ERRCODE='23505'; END IF;
  IF coalesce(v_pedido.total,0) <= 0 THEN
    RAISE EXCEPTION 'Proposta sem valor nao vai para o cliente.' USING ERRCODE='23514'; END IF;

  v_token := encode(extensions.gen_random_bytes(32), 'hex');
  v_validade := current_date + greatest(1, least(coalesce(p_dias_validade,15), 180));
  UPDATE public.sales_orders SET proposta_token=v_token, proposta_validade=v_validade, updated_at=now()
   WHERE id = p_sales_order_id;
  RETURN jsonb_build_object('token', v_token, 'validade', v_validade);
END; $function$;

CREATE OR REPLACE FUNCTION public.ratear_lancamento(p_transaction_id uuid, p_rateio jsonb)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_tx record; v_soma_pct numeric := 0; v_item jsonb; v_pct numeric; v_cc uuid;
  v_valor numeric; v_acumulado numeric := 0; v_n integer := 0; v_total integer;
BEGIN
  SELECT * INTO v_tx FROM public.transactions WHERE id = p_transaction_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Lancamento nao encontrado.' USING ERRCODE='23503'; END IF;
  IF NOT public.is_company_member(v_tx.company_id) THEN
    RAISE EXCEPTION 'Sem acesso a esta empresa.' USING ERRCODE='42501'; END IF;
  IF NOT public.pode_escrever_na_empresa(v_tx.company_id) THEN
    RAISE EXCEPTION 'Seu perfil é somente leitura nesta empresa.' USING ERRCODE='42501'; END IF;

  IF p_rateio IS NULL OR jsonb_array_length(p_rateio) = 0 THEN
    DELETE FROM public.transaction_allocations WHERE transaction_id = p_transaction_id;
    RETURN jsonb_build_object('linhas', 0, 'desfeito', true);
  END IF;

  v_total := jsonb_array_length(p_rateio);
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_rateio) LOOP
    v_pct := (v_item ->> 'percentual')::numeric;
    IF v_pct IS NULL OR v_pct <= 0 THEN
      RAISE EXCEPTION 'Percentual precisa ser maior que zero.' USING ERRCODE='23514'; END IF;
    v_soma_pct := v_soma_pct + v_pct;
  END LOOP;

  IF abs(v_soma_pct - 100) > 0.01 THEN
    RAISE EXCEPTION 'O rateio soma %, e precisa somar 100.', round(v_soma_pct,2) USING ERRCODE='23514';
  END IF;

  DELETE FROM public.transaction_allocations WHERE transaction_id = p_transaction_id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_rateio) LOOP
    v_n := v_n + 1;
    v_cc := (v_item ->> 'cost_center_id')::uuid;
    v_pct := (v_item ->> 'percentual')::numeric;
    IF v_n = v_total THEN
      v_valor := round(v_tx.amount - v_acumulado, 2);
    ELSE
      v_valor := round(v_tx.amount * v_pct / 100, 2);
      v_acumulado := v_acumulado + v_valor;
    END IF;
    IF v_valor <= 0 THEN
      RAISE EXCEPTION 'Rateio gerou parcela de valor zero ou negativo.' USING ERRCODE='23514'; END IF;
    INSERT INTO public.transaction_allocations (company_id, transaction_id, cost_center_id, percentual, valor)
    VALUES (v_tx.company_id, p_transaction_id, v_cc, v_pct, v_valor);
  END LOOP;

  RETURN jsonb_build_object('linhas', v_total, 'total', v_tx.amount);
END; $function$;

CREATE OR REPLACE FUNCTION public.reajustar_contrato(p_contract_id uuid, p_percentual numeric, p_vigencia date DEFAULT NULL::date)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_c record; v_novo numeric; v_vigencia date;
BEGIN
  SELECT * INTO v_c FROM public.contracts WHERE id = p_contract_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Contrato nao encontrado.' USING ERRCODE='23503'; END IF;
  IF NOT public.is_company_member(v_c.company_id) THEN
    RAISE EXCEPTION 'Sem acesso a esta empresa.' USING ERRCODE='42501'; END IF;
  IF NOT public.pode_escrever_na_empresa(v_c.company_id) THEN
    RAISE EXCEPTION 'Seu perfil é somente leitura nesta empresa.' USING ERRCODE='42501'; END IF;
  IF p_percentual IS NULL OR p_percentual <= -100 OR p_percentual > 100 THEN
    RAISE EXCEPTION 'Percentual de reajuste fora da faixa aceitavel.' USING ERRCODE='23514'; END IF;

  v_vigencia := COALESCE(p_vigencia, v_c.proximo_reajuste, current_date);
  v_novo := round(v_c.amount * (1 + p_percentual/100), 2);
  IF v_novo <= 0 THEN RAISE EXCEPTION 'Reajuste zeraria o contrato.' USING ERRCODE='23514'; END IF;

  INSERT INTO public.contract_adjustments
    (company_id, contract_id, valor_anterior, valor_novo, percentual, indice, vigencia, aplicado_por)
  VALUES (v_c.company_id, p_contract_id, v_c.amount, v_novo, p_percentual, v_c.indice_reajuste, v_vigencia, auth.uid());

  UPDATE public.contracts
     SET amount = v_novo, ultimo_reajuste_em = v_vigencia,
         proximo_reajuste = v_vigencia + interval '1 year', updated_at = now()
   WHERE id = p_contract_id;

  RETURN jsonb_build_object('valor_anterior', v_c.amount, 'valor_novo', v_novo,
    'percentual', p_percentual, 'vigencia', v_vigencia, 'proximo_reajuste', v_vigencia + interval '1 year');
END; $function$;

-- ── Setters de credencial (Vault): + guard pode_escrever ───────────────────
CREATE OR REPLACE FUNCTION public.set_pluggy_credentials(p_company_id uuid, p_client_id text, p_client_secret text)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_nome_id text; v_nome_secret text; v_id uuid; v_preview text;
BEGIN
  IF NOT public.is_company_member(p_company_id) THEN RAISE EXCEPTION 'Sem permissão nesta empresa'; END IF;
  IF NOT public.pode_escrever_na_empresa(p_company_id) THEN
    RAISE EXCEPTION 'Seu perfil é somente leitura nesta empresa.' USING ERRCODE='42501'; END IF;
  v_nome_id := 'pluggy_client_id_' || p_company_id::text;
  v_nome_secret := 'pluggy_client_secret_' || p_company_id::text;
  IF p_client_id IS NULL OR length(trim(p_client_id)) = 0 THEN
    DELETE FROM vault.secrets WHERE name IN (v_nome_id, v_nome_secret);
    v_preview := NULL;
  ELSE
    SELECT id INTO v_id FROM vault.secrets WHERE name = v_nome_id;
    IF v_id IS NULL THEN PERFORM vault.create_secret(trim(p_client_id), v_nome_id, 'Pluggy Client ID');
    ELSE PERFORM vault.update_secret(v_id, trim(p_client_id)); END IF;
    IF p_client_secret IS NOT NULL AND length(trim(p_client_secret)) > 0 THEN
      v_id := NULL;
      SELECT id INTO v_id FROM vault.secrets WHERE name = v_nome_secret;
      IF v_id IS NULL THEN PERFORM vault.create_secret(trim(p_client_secret), v_nome_secret, 'Pluggy Client Secret');
      ELSE PERFORM vault.update_secret(v_id, trim(p_client_secret)); END IF;
    END IF;
    v_preview := left(trim(p_client_id), 8) || '…';
  END IF;
  INSERT INTO public.openfinance_config (company_id, provider) VALUES (p_company_id, 'pluggy') ON CONFLICT (company_id, provider) DO NOTHING;
  UPDATE public.openfinance_config SET client_id_preview = v_preview WHERE company_id = p_company_id AND provider = 'pluggy';
END; $function$;

CREATE OR REPLACE FUNCTION public.set_focus_token(p_company_id uuid, p_environment text, p_token text)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_nome text; v_id uuid; v_preview text;
BEGIN
  IF NOT public.is_company_member(p_company_id) THEN RAISE EXCEPTION 'Sem permissão nesta empresa'; END IF;
  IF NOT public.pode_escrever_na_empresa(p_company_id) THEN
    RAISE EXCEPTION 'Seu perfil é somente leitura nesta empresa.' USING ERRCODE='42501'; END IF;
  IF p_environment NOT IN ('homologacao','producao') THEN RAISE EXCEPTION 'Ambiente inválido: %', p_environment; END IF;
  v_nome := 'focus_nfe_' || p_environment || '_' || p_company_id::text;
  SELECT id INTO v_id FROM vault.secrets WHERE name = v_nome;
  IF p_token IS NULL OR length(trim(p_token)) = 0 THEN
    IF v_id IS NOT NULL THEN DELETE FROM vault.secrets WHERE id = v_id; END IF;
    v_preview := NULL;
  ELSE
    IF v_id IS NULL THEN
      PERFORM vault.create_secret(trim(p_token), v_nome, 'Token Focus NFe (' || p_environment || ')');
    ELSE
      PERFORM vault.update_secret(v_id, trim(p_token));
    END IF;
    v_preview := '••••' || right(trim(p_token), 4);
  END IF;
  INSERT INTO public.focus_config (company_id) VALUES (p_company_id) ON CONFLICT (company_id) DO NOTHING;
  IF p_environment = 'homologacao' THEN
    UPDATE public.focus_config SET token_homologacao_preview = v_preview WHERE company_id = p_company_id;
  ELSE
    UPDATE public.focus_config SET token_producao_preview = v_preview WHERE company_id = p_company_id;
  END IF;
END; $function$;

CREATE OR REPLACE FUNCTION public.set_contaazul_credentials(p_company_id uuid, p_client_id text, p_client_secret text, p_refresh_token text)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_nome text := 'contaazul:' || p_company_id::text;
  v_valor text;
  v_id uuid;
BEGIN
  IF NOT public.is_company_member(p_company_id) THEN
    RAISE EXCEPTION 'Sem acesso a esta empresa.' USING ERRCODE = '42501';
  END IF;
  IF NOT public.pode_escrever_na_empresa(p_company_id) THEN
    RAISE EXCEPTION 'Seu perfil é somente leitura nesta empresa.' USING ERRCODE='42501'; END IF;
  IF coalesce(trim(p_client_id), '') = '' OR coalesce(trim(p_client_secret), '') = '' OR coalesce(trim(p_refresh_token), '') = '' THEN
    RAISE EXCEPTION 'client_id, client_secret e refresh_token são obrigatórios.' USING ERRCODE = '23514';
  END IF;

  v_valor := json_build_object(
    'client_id', trim(p_client_id),
    'client_secret', trim(p_client_secret),
    'refresh_token', trim(p_refresh_token)
  )::text;

  SELECT id INTO v_id FROM vault.secrets WHERE name = v_nome;
  IF v_id IS NULL THEN
    PERFORM vault.create_secret(v_valor, v_nome);
  ELSE
    PERFORM vault.update_secret(v_id, v_valor);
  END IF;

  INSERT INTO public.contaazul_config (company_id, client_id_preview)
  VALUES (p_company_id, '••••' || right(trim(p_client_id), 4))
  ON CONFLICT (company_id) DO UPDATE
    SET client_id_preview = '••••' || right(trim(p_client_id), 4),
        ativo = true,
        updated_at = now();
END; $function$;

-- ── Tabelas que ficaram fora do RBAC de viewer: RESTRICTIVE de escrita ─────
-- Mesmo padrão das 15 já cobertas em 20260731110000. Base real é 100% admin
-- (zero impacto); fecha viewer/demo escrevendo direto via PostgREST — inclui
-- o delete de bank_connections (cascade apaga o staging do palco).
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'purchase_orders','invoices','whatsapp_configs','api_keys',
    'openfinance_config','focus_config','contaazul_config',
    'bank_connections','bank_transactions_raw'
  ] LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'Viewer nao insere', t);
    EXECUTE format('CREATE POLICY %I ON public.%I AS RESTRICTIVE FOR INSERT WITH CHECK (public.pode_escrever_na_empresa(company_id))', 'Viewer nao insere', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'Viewer nao altera', t);
    EXECUTE format('CREATE POLICY %I ON public.%I AS RESTRICTIVE FOR UPDATE USING (public.pode_escrever_na_empresa(company_id))', 'Viewer nao altera', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'Viewer nao apaga', t);
    EXECUTE format('CREATE POLICY %I ON public.%I AS RESTRICTIVE FOR DELETE USING (public.pode_escrever_na_empresa(company_id))', 'Viewer nao apaga', t);
  END LOOP;
END $$;

-- ── Storage: conta demo não escreve/apaga no bucket documents ──────────────
DROP POLICY IF EXISTS "Demo nao envia documentos" ON storage.objects;
CREATE POLICY "Demo nao envia documentos" ON storage.objects AS RESTRICTIVE FOR INSERT
  WITH CHECK (bucket_id <> 'documents' OR NOT public.is_demo_account());
DROP POLICY IF EXISTS "Demo nao altera documentos" ON storage.objects;
CREATE POLICY "Demo nao altera documentos" ON storage.objects AS RESTRICTIVE FOR UPDATE
  USING (bucket_id <> 'documents' OR NOT public.is_demo_account());
DROP POLICY IF EXISTS "Demo nao apaga documentos" ON storage.objects;
CREATE POLICY "Demo nao apaga documentos" ON storage.objects AS RESTRICTIVE FOR DELETE
  USING (bucket_id <> 'documents' OR NOT public.is_demo_account());

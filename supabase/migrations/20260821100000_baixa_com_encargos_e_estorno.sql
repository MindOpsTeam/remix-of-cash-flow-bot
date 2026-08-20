-- Baixa parcial com juros, multa e desconto, e o estorno que nao existia.
--
-- O DEFEITO
-- O motor de baixa parcial ja estava pronto no banco (aplicar_baixa_titulo com
-- lock de linha, title_payments com unique por transacao), mas a tela nunca
-- passava o valor: so sabia quitar inteiro. Cliente paga 300 de um titulo de
-- 1000 e nao havia como registrar. Nao existia coluna de juros nem de multa em
-- lugar nenhum. E estorno nao existia: Pix devolvido, cheque devolvido e
-- chargeback so tinham a saida de APAGAR o titulo, o que destroi a trilha e
-- deixa a receita orfa no DRE.
alter table public.title_payments
  add column if not exists juros    numeric(14,2) not null default 0,
  add column if not exists multa    numeric(14,2) not null default 0,
  add column if not exists desconto numeric(14,2) not null default 0,
  add column if not exists estorno_de uuid references public.title_payments(id) on delete set null,
  add column if not exists motivo_estorno text,
  add column if not exists criado_por uuid;

-- O estorno entra como linha NEGATIVA, entao o amount deixa de ser
-- obrigatoriamente positivo. Zero segue proibido: linha de valor zero e ruido.
--
-- O CHECK original nasceu inline (`amount numeric NOT NULL CHECK (amount > 0)`),
-- e o nome que o Postgres gera para constraint inline pode variar quando ha
-- colisao. Por isso procuramos pela REGRA, nao pelo nome: um drop por nome
-- errado passaria batido e a migration deixaria a trava antiga de pe, barrando
-- todo estorno em silencio.
do $$
declare c record;
begin
  for c in
    select conname from pg_constraint
    where conrelid = 'public.title_payments'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%amount%>%0%'
  loop
    execute format('alter table public.title_payments drop constraint %I', c.conname);
  end loop;
end;
$$;

alter table public.title_payments drop constraint if exists title_payments_amount_check;
alter table public.title_payments add constraint title_payments_amount_check check (amount <> 0);

comment on column public.title_payments.juros is 'Juros cobrados nesta baixa. Vira lancamento separado, nao infla a receita da venda.';
comment on column public.title_payments.desconto is 'Desconto concedido. Abate o titulo alem do dinheiro que entrou.';
comment on column public.title_payments.estorno_de is 'Quando preenchido, esta linha ANULA a baixa apontada. Estorno nunca apaga historico.';

-- Conta contabil dos encargos. Juros recebido nao e receita de venda e juros
-- pago nao e custo de operacao: misturar corrompe a margem, que e o numero que
-- o dono olha primeiro.
create or replace function public.conta_de_encargos(p_company_id uuid, p_tipo text)
returns uuid language sql stable security definer set search_path to 'public' as $$
  select id from public.chart_of_accounts
  where company_id = p_company_id
    and type = case when p_tipo = 'revenue' then 'revenue' else 'expense' end
    and (
      code = case when p_tipo = 'revenue' then '3.4' else '5.8' end
      or name ilike case when p_tipo = 'revenue' then '%outras receitas%' else '%juros%' end
    )
  order by case when code = case when p_tipo = 'revenue' then '3.4' else '5.8' end then 0 else 1 end
  limit 1;
$$;
revoke execute on function public.conta_de_encargos(uuid, text) from public, anon;

-- Baixa pela TELA.
--
-- POR QUE UMA RPC NOVA E NAO O aplicar_baixa_titulo
-- Aquele existe para conciliar um lancamento QUE JA EXISTE no extrato: recebe
-- p_tx_id. Aqui o dinheiro ainda nao tem lancamento, e e a baixa que precisa
-- cria-lo. Os dois convivem e escrevem na mesma title_payments.
--
-- REGRA DO DINHEIRO
--   dinheiro   = p_valor_pago (o que entrou ou saiu de fato)
--   encargos   = juros + multa
--   principal  = dinheiro - encargos
--   abatimento = principal + desconto  (o desconto quita alem do que entrou)
-- Dois lancamentos: principal na conta do titulo, encargos na conta financeira.
-- Somados dao exatamente o dinheiro, e a margem nao fica suja de juros.
create or replace function public.baixar_titulo(
  p_kind text,
  p_title_id uuid,
  p_valor_pago numeric,
  p_data date default current_date,
  p_juros numeric default 0,
  p_multa numeric default 0,
  p_desconto numeric default 0,
  p_bank_account_id uuid default null
) returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare
  v_company uuid; v_total numeric; v_baixado numeric; v_account uuid;
  v_descricao text; v_tipo text;
  v_encargos numeric; v_principal numeric; v_abatimento numeric;
  v_restante numeric; v_tol numeric; v_novo numeric; v_quitado boolean;
  v_tx uuid; v_tx_encargos uuid; v_conta_encargos uuid; v_pagamento uuid;
  v_user uuid := auth.uid();
begin
  if p_valor_pago is null or p_valor_pago <= 0 then
    return jsonb_build_object('status','error','erro','Informe um valor maior que zero.');
  end if;
  p_juros := coalesce(p_juros, 0); p_multa := coalesce(p_multa, 0); p_desconto := coalesce(p_desconto, 0);
  if p_juros < 0 or p_multa < 0 or p_desconto < 0 then
    return jsonb_build_object('status','error','erro','Juros, multa e desconto nao podem ser negativos.');
  end if;

  if p_kind = 'receivable' then
    select company_id, amount, coalesce(valor_baixado,0), account_id, description, 'revenue'
      into v_company, v_total, v_baixado, v_account, v_descricao, v_tipo
      from receivables where id = p_title_id for update;
  elsif p_kind = 'bill' then
    select company_id, valor, coalesce(valor_baixado,0), account_id, coalesce(descricao, fornecedor), 'expense'
      into v_company, v_total, v_baixado, v_account, v_descricao, v_tipo
      from bills_payable where id = p_title_id for update;
  else
    return jsonb_build_object('status','error','erro','tipo de titulo invalido');
  end if;

  if v_company is null then return jsonb_build_object('status','not_found'); end if;
  if not public.pode_escrever_na_empresa(v_company) then
    raise exception 'Sem permissao para dar baixa nesta empresa.' using errcode = '42501';
  end if;

  v_encargos  := p_juros + p_multa;
  v_principal := p_valor_pago - v_encargos;
  if v_principal <= 0 then
    return jsonb_build_object('status','error','erro','O valor pago precisa ser maior que juros mais multa.');
  end if;
  v_abatimento := v_principal + p_desconto;

  v_tol      := greatest(v_total * 0.02, 0.01);
  v_restante := greatest(0, v_total - v_baixado);
  if v_restante <= 0 then return jsonb_build_object('status','already_settled'); end if;
  if v_abatimento > v_restante + v_tol then
    return jsonb_build_object('status','overpay','saldo', v_restante);
  end if;

  insert into transactions (company_id, user_id, date, description, amount, type, account_id, bank_account_id, status, source)
  values (v_company, coalesce(v_user, '00000000-0000-0000-0000-000000000000'::uuid), coalesce(p_data, current_date),
          v_descricao, round(v_principal, 2), v_tipo, v_account, p_bank_account_id, 'confirmed',
          case when p_kind = 'receivable' then 'receivable' else 'bill_payable' end)
  returning id into v_tx;

  if v_encargos > 0 then
    v_conta_encargos := public.conta_de_encargos(v_company, case when p_kind='receivable' then 'revenue' else 'expense' end);
    insert into transactions (company_id, user_id, date, description, amount, type, account_id, bank_account_id, status, source)
    values (v_company, coalesce(v_user, '00000000-0000-0000-0000-000000000000'::uuid), coalesce(p_data, current_date),
            case when p_kind='receivable' then 'Juros e multa recebidos: ' else 'Juros e multa pagos: ' end || v_descricao,
            round(v_encargos, 2), v_tipo, v_conta_encargos, p_bank_account_id, 'confirmed', 'encargos')
    returning id into v_tx_encargos;
  end if;

  insert into title_payments (company_id, title_kind, title_id, transaction_id, amount, paid_at, juros, multa, desconto, criado_por)
  values (v_company, p_kind, p_title_id, v_tx, round(v_abatimento, 2), coalesce(p_data, current_date),
          p_juros, p_multa, p_desconto, v_user)
  returning id into v_pagamento;

  v_novo    := v_baixado + v_abatimento;
  v_quitado := v_novo >= v_total - v_tol;

  if p_kind = 'receivable' then
    update receivables set valor_baixado = v_novo,
      status = case when v_quitado then 'recebido' else status end,
      transaction_id = case when v_quitado then v_tx else transaction_id end,
      payment_date = case when v_quitado then coalesce(p_data, current_date) else payment_date end,
      updated_at = now()
    where id = p_title_id;
  else
    update bills_payable set valor_baixado = v_novo,
      status = case when v_quitado then 'pago' else status end,
      transaction_id = case when v_quitado then v_tx else transaction_id end,
      payment_date = case when v_quitado then coalesce(p_data, current_date) else payment_date end,
      updated_at = now()
    where id = p_title_id;
  end if;

  return jsonb_build_object(
    'status', case when v_quitado then 'settled' else 'partial' end,
    'pagamento_id', v_pagamento,
    'abatido', round(v_abatimento, 2),
    'dinheiro', round(p_valor_pago, 2),
    'saldo', round(greatest(0, v_total - v_novo), 2));
end; $$;
grant execute on function public.baixar_titulo(text,uuid,numeric,date,numeric,numeric,numeric,uuid) to authenticated;

-- Estorno. NUNCA apaga: insere linha negativa apontando para a baixa original,
-- cria o lancamento contrario e devolve o titulo ao estado anterior.
create or replace function public.estornar_baixa(p_pagamento_id uuid, p_motivo text)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare
  p record; v_total numeric; v_baixado numeric; v_novo numeric;
  v_tx uuid; v_descricao text; v_tipo text; v_conta uuid;
  v_user uuid := auth.uid();
begin
  if coalesce(length(trim(p_motivo)), 0) < 5 then
    return jsonb_build_object('status','error','erro','Explique o motivo do estorno em pelo menos 5 caracteres.');
  end if;

  select * into p from title_payments where id = p_pagamento_id for update;
  if p.id is null then return jsonb_build_object('status','not_found'); end if;
  if not public.pode_escrever_na_empresa(p.company_id) then
    raise exception 'Sem permissao para estornar nesta empresa.' using errcode = '42501';
  end if;
  if p.estorno_de is not null then
    return jsonb_build_object('status','error','erro','Esta linha ja e um estorno.');
  end if;
  if exists (select 1 from title_payments e where e.estorno_de = p.id) then
    return jsonb_build_object('status','error','erro','Esta baixa ja foi estornada.');
  end if;

  if p.title_kind = 'receivable' then
    select amount, coalesce(valor_baixado,0), description, 'revenue', account_id
      into v_total, v_baixado, v_descricao, v_tipo, v_conta
      from receivables where id = p.title_id for update;
  else
    select valor, coalesce(valor_baixado,0), coalesce(descricao, fornecedor), 'expense', account_id
      into v_total, v_baixado, v_descricao, v_tipo, v_conta
      from bills_payable where id = p.title_id for update;
  end if;

  -- Data de HOJE, nao a da baixa original: o estorno aconteceu hoje, e
  -- antedatar mexeria em mes possivelmente ja fechado.
  insert into transactions (company_id, user_id, date, description, amount, type, account_id, status, source)
  values (p.company_id, coalesce(v_user, '00000000-0000-0000-0000-000000000000'::uuid), current_date,
          'Estorno: ' || v_descricao || ' (' || p_motivo || ')',
          round(p.amount, 2),
          case when v_tipo = 'revenue' then 'expense' else 'revenue' end,
          v_conta, 'confirmed', 'estorno')
  returning id into v_tx;

  insert into title_payments (company_id, title_kind, title_id, transaction_id, amount, paid_at,
                              juros, multa, desconto, estorno_de, motivo_estorno, criado_por)
  values (p.company_id, p.title_kind, p.title_id, v_tx, -p.amount, current_date,
          -p.juros, -p.multa, -p.desconto, p.id, p_motivo, v_user);

  v_novo := greatest(0, v_baixado - p.amount);

  if p.title_kind = 'receivable' then
    update receivables set valor_baixado = v_novo,
      status = 'a_receber', transaction_id = null, payment_date = null, updated_at = now()
    where id = p.title_id;
  else
    update bills_payable set valor_baixado = v_novo,
      status = 'pendente', transaction_id = null, payment_date = null, updated_at = now()
    where id = p.title_id;
  end if;

  return jsonb_build_object('status','estornado','valor', round(p.amount,2), 'saldo_baixado', round(v_novo,2));
end; $$;
grant execute on function public.estornar_baixa(uuid, text) to authenticated;

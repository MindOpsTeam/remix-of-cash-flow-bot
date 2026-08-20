-- "Bate ou nao bate": a unica pergunta que o financeiro precisa responder no
-- fim do dia, e que o sistema nao respondia.
--
-- `bank_accounts.balance` guardava o numero do provedor e o cockpit somava isso
-- e chamava de caixa. Ninguem nunca comparava com o que os lancamentos dizem.
--
-- HONESTIDADE DO NUMERO
-- Lancamento sem `bank_account_id` nao pertence a conta nenhuma e por isso nao
-- entra na soma. A view devolve quantos sao: sem esse contador a diferenca
-- apareceria como erro de conciliacao quando na verdade e lancamento sem conta
-- atribuida, que e problema diferente e de outro dono.
create or replace view public.v_conciliacao_saldo
with (security_invoker = on) as
select
  b.company_id,
  b.id as bank_account_id,
  b.name as conta,
  b.bank_name,
  b.balance as saldo_extrato,
  b.saldo_inicial,
  b.saldo_inicial_data,
  coalesce(b.saldo_inicial, 0) + coalesce(mov.movimento, 0) as saldo_sistema,
  case when b.balance is null then null
       else round(b.balance - (coalesce(b.saldo_inicial, 0) + coalesce(mov.movimento, 0)), 2)
  end as diferenca,
  coalesce(mov.lancamentos, 0) as lancamentos_na_conta,
  coalesce(orfaos.qtd, 0) as lancamentos_sem_conta_bancaria,
  case
    when b.balance is null then 'sem_extrato'
    when abs(b.balance - (coalesce(b.saldo_inicial, 0) + coalesce(mov.movimento, 0))) < 0.01 then 'bate'
    else 'diverge'
  end as situacao
from public.bank_accounts b
left join lateral (
  select
    sum(case when t.type = 'revenue' then t.amount else -t.amount end) as movimento,
    count(*) as lancamentos
  from public.transactions t
  where t.bank_account_id = b.id
    and t.status in ('confirmed','reconciled')
    and (b.saldo_inicial_data is null or t.date > b.saldo_inicial_data)
) mov on true
left join lateral (
  select count(*) as qtd from public.transactions t2
  where t2.company_id = b.company_id
    and t2.bank_account_id is null
    and t2.status in ('confirmed','reconciled')
) orfaos on true;

comment on view public.v_conciliacao_saldo is
  'Saldo do extrato contra saldo derivado dos lancamentos, por conta. lancamentos_sem_conta_bancaria explica a parte que nao da para comparar.';

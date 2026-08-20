-- Carga inicial da carteira.
--
-- O DEFEITO
-- O cliente chega no dia 1 com 180 titulos em aberto numa planilha e o unico
-- caminho era digitar um a um ou OAuth do Conta Azul. O sistema mostrava aging
-- vazio, inadimplencia zero e agente de cobranca sem nada para cobrar. Ele
-- volta pro Excel na primeira semana.
alter table public.receivables    add column if not exists import_batch_id uuid;
alter table public.bills_payable  add column if not exists import_batch_id uuid;
create index if not exists receivables_lote_idx   on public.receivables (company_id, import_batch_id);
create index if not exists bills_payable_lote_idx on public.bills_payable (company_id, import_batch_id);

comment on column public.receivables.import_batch_id is
  'Lote da importacao. Existe para o cliente poder DESFAZER uma carga errada sem cacar linha por linha.';

-- Desfazer o lote inteiro. So apaga o que a importacao criou e que ninguem
-- encostou depois: titulo com baixa ja registrada FICA, porque apagar dinheiro
-- ja conciliado seria pior que o erro original.
create or replace function public.desfazer_importacao(p_company_id uuid, p_lote uuid)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare v_rec int; v_bill int; v_presos int;
begin
  if not public.pode_escrever_na_empresa(p_company_id) then
    raise exception 'Sem permissao nesta empresa.' using errcode = '42501';
  end if;

  select count(*) into v_presos from (
    select id from public.receivables
     where company_id = p_company_id and import_batch_id = p_lote and coalesce(valor_baixado,0) > 0
    union all
    select id from public.bills_payable
     where company_id = p_company_id and import_batch_id = p_lote and coalesce(valor_baixado,0) > 0
  ) x;

  delete from public.receivables
   where company_id = p_company_id and import_batch_id = p_lote and coalesce(valor_baixado,0) = 0;
  get diagnostics v_rec = row_count;

  delete from public.bills_payable
   where company_id = p_company_id and import_batch_id = p_lote and coalesce(valor_baixado,0) = 0;
  get diagnostics v_bill = row_count;

  return jsonb_build_object(
    'status','ok',
    'recebiveis_removidos', v_rec,
    'contas_removidas', v_bill,
    'mantidos_com_baixa', v_presos);
end; $$;
grant execute on function public.desfazer_importacao(uuid, uuid) to authenticated;

-- A carga precisa de origem propria. Sem ela o titulo importado se disfarca de
-- "manual" e ninguem distingue o que veio da planilha do que foi digitado, que
-- e justamente o que se quer saber quando a carga sai errada.
alter table public.receivables drop constraint if exists receivables_source_check;
alter table public.receivables add constraint receivables_source_check
  check (source = any (array['contrato','asaas','manual','pedido','pdv','contaazul','nota_fiscal','importacao']));

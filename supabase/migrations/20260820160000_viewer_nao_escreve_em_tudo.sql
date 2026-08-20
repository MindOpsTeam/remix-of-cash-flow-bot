-- Viewer escrevia em conta bancaria e em fechamento de mes.
--
-- O DEFEITO
-- As tabelas transactions, receivables e bills_payable tinham DUAS travas
-- RESTRICTIVE: a de template e a de papel ("Viewer nao insere/altera/apaga").
-- bank_accounts, monthly_close, tax_guides, title_payments e invoices tinham
-- so a de template. Na pratica um usuario somente-leitura apagava conta
-- bancaria e reabria mes fechado com um PATCH direto no PostgREST,
-- contornando `reabrir_mes`, que exige motivo e grava historico.
do $$
declare t text;
begin
  foreach t in array array['bank_accounts','monthly_close','tax_guides','title_payments','invoices'] loop
    execute format('drop policy if exists "Viewer nao insere" on public.%I', t);
    execute format('drop policy if exists "Viewer nao altera" on public.%I', t);
    execute format('drop policy if exists "Viewer nao apaga"  on public.%I', t);
    execute format('create policy "Viewer nao insere" on public.%I as restrictive for insert to authenticated with check (public.pode_escrever_na_empresa(company_id))', t);
    execute format('create policy "Viewer nao altera" on public.%I as restrictive for update to authenticated using (public.pode_escrever_na_empresa(company_id))', t);
    execute format('create policy "Viewer nao apaga"  on public.%I as restrictive for delete to authenticated using (public.pode_escrever_na_empresa(company_id))', t);
  end loop;
end;
$$;

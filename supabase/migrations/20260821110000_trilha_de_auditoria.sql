-- Trilha de auditoria e a separacao real entre admin e membro.
--
-- O DEFEITO
-- Nenhuma tabela de log em 160 migrations, zero soft delete, DELETE fisico em
-- lancamento, conta a pagar e conta bancaria. Pior: o gatilho de partida
-- dobrada APAGA a partida anterior no UPDATE. O socio pergunta o que aconteceu
-- com os 30 mil e a resposta honesta e "nao da para saber". Numa PME familiar
-- isso encerra a conversa sobre o sistema.
--
-- E `pode_escrever_na_empresa` aprovava admin e member igualmente: era o unico
-- helper de papel que existia, entao nao havia como gatear convite de usuario
-- nem a leitura desta trilha.
create or replace function public.is_company_admin(p_company_id uuid)
returns boolean language sql stable security definer set search_path to 'public' as $$
  select exists (
    select 1 from public.company_members
     where company_id = p_company_id
       and user_id = auth.uid()
       and role = 'admin'
  );
$$;
grant execute on function public.is_company_admin(uuid) to authenticated;

create table if not exists public.audit_log (
  id bigserial primary key,
  company_id uuid not null,
  user_id uuid,
  tabela text not null,
  registro_id uuid,
  operacao text not null check (operacao in ('INSERT','UPDATE','DELETE')),
  antes jsonb,
  depois jsonb,
  campos text[],
  em timestamptz not null default now()
);
create index if not exists audit_log_empresa_idx on public.audit_log (company_id, em desc);
create index if not exists audit_log_registro_idx on public.audit_log (tabela, registro_id, em desc);
alter table public.audit_log enable row level security;

-- Leitura so para ADMIN: a trilha existe para o dono conferir o funcionario,
-- entao o funcionario nao pode ser quem le. Nao ha policy de INSERT, UPDATE nem
-- DELETE: so o trigger escreve, e ninguem edita a propria pegada.
drop policy if exists "Admin le a trilha" on public.audit_log;
create policy "Admin le a trilha" on public.audit_log
  for select to authenticated using (public.is_company_admin(company_id));

comment on table public.audit_log is
  'Quem alterou o que, com o valor anterior. Somente INSERT por trigger; ninguem edita nem apaga.';

create or replace function public.registrar_auditoria()
returns trigger language plpgsql security definer set search_path to 'public' as $$
declare
  v_antes jsonb; v_depois jsonb; v_campos text[]; v_empresa uuid; v_id uuid;
begin
  if tg_op = 'DELETE' then
    v_antes := to_jsonb(OLD); v_depois := null;
    v_empresa := (v_antes->>'company_id')::uuid; v_id := (v_antes->>'id')::uuid;
  elsif tg_op = 'INSERT' then
    v_antes := null; v_depois := to_jsonb(NEW);
    v_empresa := (v_depois->>'company_id')::uuid; v_id := (v_depois->>'id')::uuid;
  else
    v_antes := to_jsonb(OLD); v_depois := to_jsonb(NEW);
    v_empresa := (v_depois->>'company_id')::uuid; v_id := (v_depois->>'id')::uuid;

    -- So o que MUDOU. Gravar a linha inteira a cada update infla a tabela e
    -- esconde a alteracao real no meio de trinta campos iguais.
    select array_agg(chave) into v_campos
    from jsonb_object_keys(v_depois) chave
    where chave not in ('updated_at')
      and v_antes->chave is distinct from v_depois->chave;

    if v_campos is null then return NEW; end if;

    v_antes  := (select jsonb_object_agg(k, v_antes->k)  from unnest(v_campos) k where v_antes ? k);
    v_depois := (select jsonb_object_agg(k, v_depois->k) from unnest(v_campos) k);
  end if;

  insert into public.audit_log (company_id, user_id, tabela, registro_id, operacao, antes, depois, campos)
  values (v_empresa, auth.uid(), tg_table_name, v_id, tg_op, v_antes, v_depois, v_campos);

  if tg_op = 'DELETE' then return OLD; end if;
  return NEW;
end; $$;
revoke execute on function public.registrar_auditoria() from public, anon, authenticated;

-- Tabelas onde alterar numero muda dinheiro.
do $$
declare t text;
begin
  foreach t in array array[
    'transactions','receivables','bills_payable','bank_accounts',
    'title_payments','tax_guides','invoices','monthly_close','contracts'
  ] loop
    execute format('drop trigger if exists trg_auditoria on public.%I', t);
    execute format('create trigger trg_auditoria after insert or update or delete on public.%I for each row execute function public.registrar_auditoria()', t);
  end loop;
end;
$$;

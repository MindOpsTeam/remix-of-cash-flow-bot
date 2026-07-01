-- ============================================================
-- Multi-tenant: org_id por empresa (CNPJ) + BI de margem
-- Cada CNPJ é uma organização (company) com org_id próprio.
-- O "cliente" vincula até 6 CNPJs; o agrupamento é o conjunto de
-- empresas onde o usuário é membro (RLS via is_company_member).
-- ============================================================

-- 1) Gerador de org_id legível e estável
create or replace function public.gen_org_id()
returns text language sql volatile as $fn$
  select 'ORG-' || upper(substr(md5(gen_random_uuid()::text), 1, 6))
$fn$;

-- 2) Coluna org_id em companies (uma organização por CNPJ)
alter table public.companies add column if not exists org_id text;
update public.companies set org_id = public.gen_org_id() where org_id is null;
alter table public.companies alter column org_id set default public.gen_org_id();
alter table public.companies alter column org_id set not null;
create unique index if not exists companies_org_id_key on public.companies(org_id);

-- 3) create_company_for_user: aceita CNPJ, limita a 6 CNPJs por cliente, retorna org_id
drop function if exists public.create_company_for_user(text);
create or replace function public.create_company_for_user(company_name text, company_cnpj text default null)
returns json language plpgsql security definer set search_path to 'public' as $fn$
declare
  new_company_id uuid;
  n_companies int;
  clean_cnpj text;
  result json;
begin
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
$fn$;

-- 4) View BI de margem: por empresa e por mês
--    Bruta = Receita - Custos(4.x) ; Operacional = Bruta - Despesas(5.x/demais)
--    security_invoker = on -> respeita RLS do usuário (is_company_member)
drop view if exists public.v_company_margin;
create view public.v_company_margin with (security_invoker = on) as
select
  t.company_id,
  (date_trunc('month', t.date))::date as month,
  coalesce(sum(t.amount) filter (where t.type = 'revenue'), 0) as receita,
  coalesce(sum(t.amount) filter (where t.type = 'expense' and left(coalesce(coa.code,''),1) = '4'), 0) as custos,
  coalesce(sum(t.amount) filter (where t.type = 'expense' and left(coalesce(coa.code,''),1) <> '4'), 0) as despesas
from public.transactions t
left join public.chart_of_accounts coa on coa.id = t.account_id
where t.status = 'confirmed'
group by t.company_id, date_trunc('month', t.date);

grant select on public.v_company_margin to authenticated;

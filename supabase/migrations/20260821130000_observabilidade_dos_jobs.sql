-- Observabilidade dos jobs.
--
-- O DEFEITO
-- `net.http_post` e assincrono: o pg_cron marca "succeeded" mesmo quando a edge
-- devolve 500 ou nem carrega. Foi exatamente assim que duas edge functions
-- ficaram mortas em producao sem ninguem ver, por semanas.
create table if not exists public.job_runs (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  disparado_em timestamptz not null default now(),
  concluido_em timestamptz,
  ok boolean,
  erro text,
  detalhe jsonb,
  request_id bigint
);
create index if not exists job_runs_nome_idx on public.job_runs (nome, disparado_em desc);

alter table public.job_runs enable row level security;
drop policy if exists "Admin le os jobs" on public.job_runs;
create policy "Admin le os jobs" on public.job_runs
  for select to authenticated using (
    exists (select 1 from public.company_members m where m.user_id = auth.uid() and m.role = 'admin')
  );

comment on table public.job_runs is
  'Uma linha por disparo de job. concluido_em nulo por muito tempo significa que a edge nunca respondeu.';

-- O disparo passa a deixar rastro ANTES de sair. Se a edge nunca chamar de
-- volta, a linha fica aberta e a AUSENCIA vira o sinal, que e justamente o que
-- faltava.
create or replace function public.chamar_funcao_agendada(p_slug text)
returns bigint language plpgsql security definer set search_path to 'public' as $$
declare v_secret text; v_base text; v_run uuid; v_req bigint;
begin
  v_secret := public.ensure_cron_secret();
  if v_secret is null or v_secret = '' then
    raise exception 'Nao foi possivel provisionar o segredo do cron.';
  end if;
  select functions_url into v_base from public.platform_settings where id;
  if v_base is null or v_base = '' then
    raise exception 'O endereco das edge functions desta instalacao nao foi registrado ainda.';
  end if;

  insert into public.job_runs (nome) values (p_slug) returning id into v_run;

  v_req := net.http_post(
    url := v_base || '/' || p_slug,
    headers := jsonb_build_object(
      'Content-Type','application/json',
      'X-Cron-Secret', v_secret,
      'X-Job-Run', v_run::text),
    body := jsonb_build_object('job_run_id', v_run));

  update public.job_runs set request_id = v_req where id = v_run;
  return v_req;
end; $$;

-- A propria edge fecha a linha.
create or replace function public.encerrar_job_run(p_run_id uuid, p_ok boolean, p_erro text default null, p_detalhe jsonb default null)
returns void language sql security definer set search_path to 'public' as $$
  update public.job_runs
     set concluido_em = now(), ok = p_ok, erro = left(p_erro, 2000), detalhe = p_detalhe
   where id = p_run_id and concluido_em is null;
$$;
revoke execute on function public.encerrar_job_run(uuid, boolean, text, jsonb) from public, anon, authenticated;
grant execute on function public.encerrar_job_run(uuid, boolean, text, jsonb) to service_role;

-- Saude dos jobs. "nao respondeu" e o estado mais importante e era o invisivel.
create or replace view public.v_saude_jobs
with (security_invoker = on) as
select
  j.jobname,
  j.schedule,
  j.active,
  r.disparado_em as ultimo_disparo,
  r.concluido_em,
  r.ok,
  r.erro,
  case
    when r.id is null then 'nunca disparou'
    when r.concluido_em is null and r.disparado_em < now() - interval '15 minutes' then 'nao respondeu'
    when r.concluido_em is null then 'em execucao'
    when r.ok then 'ok'
    else 'falhou'
  end as situacao
from cron.job j
left join lateral (
  select * from public.job_runs jr
  where j.command like '%' || jr.nome || '%'
  order by jr.disparado_em desc limit 1
) r on true;

comment on view public.v_saude_jobs is
  'Um job por linha com o veredito do ultimo disparo. "nao respondeu" e o estado que denuncia edge function morta.';

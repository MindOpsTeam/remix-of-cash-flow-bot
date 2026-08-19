-- Bootstrap da instalação: faz um remix nascer operacional.
--
-- ACHADO (19/08/2026, remix de prova 24b4a993)
-- O remix copia a ESTRUTURA do banco, nunca os dados. Consequência medida no
-- remix cru: platform_settings com 0 linhas (logo, sem functions_url, e
-- `chamar_funcao_agendada` levanta exceção), cron.job com 0 jobs, e nenhum
-- plano cadastrado. Ou seja, os 8 agendamentos do produto simplesmente não
-- existiam e nada acusava: as telas abrem normalmente e o automático nunca roda.
--
-- Não adianta pôr `cron.schedule` em migration: schedule insere LINHA, é dado,
-- e dado não é copiado. Por isso o provisionamento é uma função idempotente que
-- o app chama no primeiro acesso do admin.

create or replace function public.bootstrap_instalacao(p_functions_url text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_url text;
  v_criados int := 0;
  v_settings boolean := false;
begin
  -- 1. endereço das edge functions desta instalação
  select functions_url into v_url from public.platform_settings limit 1;

  if v_url is null or v_url = '' then
    v_url := nullif(trim(coalesce(p_functions_url, '')), '');
    if v_url is null then
      return jsonb_build_object(
        'ok', false,
        'erro', 'Informe o endereco das edge functions desta instalacao para concluir a configuracao.');
    end if;
    if exists (select 1 from public.platform_settings) then
      update public.platform_settings set functions_url = v_url;
    else
      insert into public.platform_settings (functions_url) values (v_url);
    end if;
    v_settings := true;
  end if;

  -- 2. agendamentos. cron.schedule com o mesmo nome substitui, então é idempotente.
  if not exists (select 1 from cron.job where jobname = 'smart-alerts-daily') then
    perform cron.schedule('smart-alerts-daily','0 11 * * *',
      $c$select public.chamar_funcao_agendada('smart-alerts')$c$); v_criados := v_criados + 1;
  end if;
  if not exists (select 1 from cron.job where jobname = 'agent-anomalies-daily') then
    perform cron.schedule('agent-anomalies-daily','30 11 * * *',
      $c$select public.chamar_funcao_agendada('agent-anomalies')$c$); v_criados := v_criados + 1;
  end if;
  if not exists (select 1 from cron.job where jobname = 'agent-runner-daily') then
    perform cron.schedule('agent-runner-daily','45 11 * * *',
      $c$select public.chamar_funcao_agendada('agent-runner')$c$); v_criados := v_criados + 1;
  end if;
  if not exists (select 1 from cron.job where jobname = 'agent-collections-daily') then
    perform cron.schedule('agent-collections-daily','0 12 * * *',
      $c$select public.chamar_funcao_agendada('agent-collections')$c$); v_criados := v_criados + 1;
  end if;
  if not exists (select 1 from cron.job where jobname = 'contracts-billing-daily') then
    perform cron.schedule('contracts-billing-daily','0 6 * * *',
      $c$select public.chamar_funcao_agendada('contracts-billing')$c$); v_criados := v_criados + 1;
  end if;
  if not exists (select 1 from cron.job where jobname = 'openfinance-sync-daily') then
    perform cron.schedule('openfinance-sync-daily','30 8 * * *',
      $c$select public.chamar_funcao_agendada('openfinance-sync')$c$); v_criados := v_criados + 1;
  end if;
  if not exists (select 1 from cron.job where jobname = 'indices-sync-mensal') then
    perform cron.schedule('indices-sync-mensal','0 5 12 * *',
      $c$select public.chamar_funcao_agendada('indices-sync')$c$); v_criados := v_criados + 1;
  end if;
  if not exists (select 1 from cron.job where jobname = 'tax-rates-sync-weekly') then
    perform cron.schedule('tax-rates-sync-weekly','0 4 * * 1',
      $c$select public.chamar_funcao_agendada('tax-rates-sync')$c$); v_criados := v_criados + 1;
  end if;

  -- 3. o segredo interno do cron (idempotente, ver 20260819160000)
  perform public.ensure_cron_secret();

  return jsonb_build_object(
    'ok', true,
    'functions_url_definida', v_settings,
    'agendamentos_criados', v_criados,
    'agendamentos_ativos', (select count(*) from cron.job where active)
  );
end;
$fn$;

revoke execute on function public.bootstrap_instalacao(text) from public, anon;
grant  execute on function public.bootstrap_instalacao(text) to authenticated, service_role;

comment on function public.bootstrap_instalacao(text) is
  'Idempotente. Preenche platform_settings, cria os 8 agendamentos e provisiona o segredo do cron. Existe porque o remix copia estrutura e nao dados: sem isto, um remix nasce sem nenhum job e o automatico nunca roda.';

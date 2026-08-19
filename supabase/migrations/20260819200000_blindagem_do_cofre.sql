-- Blindagem das leituras de segredo, para sobreviver ao remix.
--
-- ACHADO (19/08/2026, remix de verificação 24b4a993)
-- O remix copia a ESTRUTURA do banco, mas NÃO os privilégios. Os REVOKE/GRANT
-- aplicados no projeto original simplesmente não existem lá: no remix cru,
-- `get_integration_secret` nascia executável por `authenticated`, ou seja,
-- qualquer membro logado poderia ler qualquer credencial da empresa dele.
--
-- CORREÇÃO
-- A autorização deixa de depender só do GRANT e passa a viver DENTRO da função.
-- Corpo de função é código, e código É copiado no remix. O GRANT continua como
-- segunda camada.
--
-- POR QUE NÃO current_user
-- Em SECURITY DEFINER, `current_user` é o DONO da função (postgres), não quem
-- chamou: uma checagem com ele nunca dispararia. O papel real do chamador vem
-- da claim do JWT.

-- Papel do chamador, tolerante a claim ausente ou malformada.
-- Sem o tratamento de exceção, uma claim vazia derruba toda função que consulta
-- o papel (verificado: `set_config('request.jwt.claims','')` quebrava a leitura).
create or replace function public.papel_do_chamador()
returns text
language plpgsql
stable
security definer
set search_path = public
as $fn$
declare v_role text;
begin
  begin
    v_role := nullif(current_setting('request.jwt.claims', true), '')::json->>'role';
  exception when others then
    v_role := null;
  end;
  return v_role;
end;
$fn$;

comment on function public.papel_do_chamador() is
  'Papel do JWT de quem chamou. NULL para chamada interna do banco (pg_cron). Usado nas funções de leitura de segredo, porque current_user em SECURITY DEFINER é o dono e não o chamador.';

-- Credenciais de integração
create or replace function public.get_integration_secret(
  p_company_id uuid,
  p_provider   text,
  p_campo      text
) returns text
language plpgsql
stable
security definer
set search_path = public, vault
as $fn$
declare v_role text := public.papel_do_chamador();
begin
  -- NULL = chamada interna do banco (pg_cron / chamar_funcao_agendada), que
  -- precisa passar. Havendo JWT, só o servidor lê.
  if v_role is not null and v_role <> 'service_role' then
    raise exception 'apenas o servidor pode ler credenciais de integracao'
      using errcode = '42501';
  end if;
  return (
    select decrypted_secret from vault.decrypted_secrets
     where name = 'integracao:' || p_provider || ':' || p_company_id::text || ':' || p_campo
     limit 1
  );
end;
$fn$;

revoke execute on function public.get_integration_secret(uuid, text, text) from public;
revoke execute on function public.get_integration_secret(uuid, text, text) from anon;
revoke execute on function public.get_integration_secret(uuid, text, text) from authenticated;
grant  execute on function public.get_integration_secret(uuid, text, text) to service_role;

-- Segredos fiscais (certificado A1 e chave do worker)
create or replace function public.get_nfse_secrets(p_company_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, vault
as $fn$
declare v_role text := public.papel_do_chamador();
begin
  if v_role is not null and v_role <> 'service_role' then
    raise exception 'apenas o servidor pode ler segredos fiscais'
      using errcode = '42501';
  end if;
  return (
    select jsonb_build_object(
      'cert_pfx_base64', n.cert_pfx_base64,
      'cert_password',   (select decrypted_secret from vault.decrypted_secrets
                           where name = 'integracao:nfse:'||p_company_id::text||':cert_password' limit 1),
      'worker_api_key',  (select decrypted_secret from vault.decrypted_secrets
                           where name = 'integracao:nfse:'||p_company_id::text||':worker_api_key' limit 1))
    from public.nfse_config n where n.company_id = p_company_id limit 1
  );
end;
$fn$;

revoke execute on function public.get_nfse_secrets(uuid) from public, anon, authenticated;
grant  execute on function public.get_nfse_secrets(uuid) to service_role;

-- Segredo interno do cron
create or replace function public.get_cron_secret()
returns text
language plpgsql
security definer
set search_path = public, vault
as $fn$
declare v_role text := public.papel_do_chamador();
begin
  if v_role is not null and v_role <> 'service_role' then
    raise exception 'apenas o servidor pode ler o segredo do cron'
      using errcode = '42501';
  end if;
  return public.ensure_cron_secret();
end;
$fn$;

revoke execute on function public.get_cron_secret() from public, anon, authenticated;
grant  execute on function public.get_cron_secret() to service_role;

-- Reaplica os REVOKE/GRANT de coluna. No remix as colunas nascem vazias (dados
-- não são copiados) e toda gravação nova vai para o cofre, mas manter o
-- fechamento evita que um código futuro volte a gravar ali e vaze.
do $$
begin
  execute 'revoke select on public.company_asaas_config from anon, authenticated';
  execute 'grant select (id, company_id, environment, webhook_id, webhook_url, webhook_email,
           webhook_send_type, webhook_status, enabled_events, notification_email,
           created_at, updated_at) on public.company_asaas_config to anon, authenticated';

  execute 'revoke select on public.inter_config from anon, authenticated';
  execute 'grant select (id, company_id, bank_account_id, client_id, cert_pem, account_number,
           environment, active, last_sync_at, last_balance, last_balance_at,
           created_at, updated_at) on public.inter_config to anon, authenticated';

  execute 'revoke select on public.plugnotas_config from anon, authenticated';
  execute 'grant select (id, company_id, environment, plugnotas_empresa_cnpj, plugnotas_empresa_id,
           enabled_nfe, enabled_nfse, enabled_nfce, enabled_cte, enabled_mdfe,
           serie_padrao, active, last_test_at, last_test_status, last_emission_at,
           created_at, updated_at) on public.plugnotas_config to anon, authenticated';

  execute 'revoke select on public.whatsapp_configs from anon, authenticated';
  execute 'grant select (id, company_id, instance_name, active, created_at, updated_at,
           evolution_api_url, phone_number, group_jid, group_name, notify_number)
           on public.whatsapp_configs to anon, authenticated';
exception when others then
  raise notice 'grants de credencial nao aplicados: %', sqlerrm;
end $$;

-- Todas as credenciais de integração passam a viver no Vault.
--
-- ACHADO DA AUDITORIA (19/08/2026)
-- Oito colunas de credencial eram legíveis por QUALQUER usuário autenticado da
-- empresa, via SELECT com RLS. As piores: `inter_config.key_pem` (chave privada
-- do banco), `company_asaas_config.api_key_production` (gateway de pagamento em
-- produção), `plugnotas_config.api_key` e `whatsapp_configs.evolution_api_key`.
-- Só `nfse_config` estava protegido (migration 20260812190000).
--
-- PADRÃO ADOTADO (o mesmo do Stripe, migration 20260802110000)
--   nome no cofre: integracao:<provider>:<company_id>:<campo>
--   gravar  -> set_integration_secret   (authenticated, exige membership)
--   ler     -> get_integration_secret   (SÓ service_role: os edges)
--   status  -> integration_secrets_status (devolve booleanos, nunca valor)
--
-- Depois de migrar os valores, o SELECT das colunas é revogado para o cliente e
-- o conteúdo é apagado da tabela. As colunas ficam (nulas) para não quebrar
-- código que ainda as referencia; o DROP vem numa migration seguinte, depois de
-- uma janela de validação.

-- ---------------------------------------------------------------- helpers ---

create or replace function public.set_integration_secret(
  p_company_id uuid,
  p_provider   text,
  p_campo      text,
  p_valor      text
) returns void
language plpgsql security definer set search_path = public, vault
as $fn$
declare
  v_nome text;
  v_id uuid;
begin
  if not public.is_company_member(p_company_id) then
    raise exception 'sem acesso a esta empresa';
  end if;
  if p_provider is null or p_campo is null then
    raise exception 'provider e campo são obrigatórios';
  end if;

  v_nome := 'integracao:' || p_provider || ':' || p_company_id::text || ':' || p_campo;
  select id into v_id from vault.secrets where name = v_nome;

  -- valor vazio remove o segredo (é assim que a UI "desconfigura" a integração)
  if p_valor is null or length(trim(p_valor)) = 0 then
    if v_id is not null then delete from vault.secrets where id = v_id; end if;
    return;
  end if;

  if v_id is null then
    perform vault.create_secret(trim(p_valor), v_nome, 'Credencial de integração');
  else
    perform vault.update_secret(v_id, trim(p_valor));
  end if;
end;
$fn$;

revoke execute on function public.set_integration_secret(uuid, text, text, text) from public, anon;
grant execute on function public.set_integration_secret(uuid, text, text, text) to authenticated;

-- Leitura do VALOR: só os edges (service_role). Nunca exposta ao browser.
create or replace function public.get_integration_secret(
  p_company_id uuid,
  p_provider   text,
  p_campo      text
) returns text
language sql stable security definer set search_path = public, vault
as $fn$
  select decrypted_secret from vault.decrypted_secrets
   where name = 'integracao:' || p_provider || ':' || p_company_id::text || ':' || p_campo
   limit 1;
$fn$;

revoke execute on function public.get_integration_secret(uuid, text, text) from public, anon, authenticated;
grant execute on function public.get_integration_secret(uuid, text, text) to service_role;

-- Status para a UI: booleanos, nunca o valor.
create or replace function public.integration_secrets_status(p_company_id uuid)
returns table(provider text, campo text, configurado boolean)
language sql stable security definer set search_path = public, vault
as $fn$
  select
    split_part(s.name, ':', 2) as provider,
    split_part(s.name, ':', 4) as campo,
    true                       as configurado
  from vault.secrets s
  where public.is_company_member(p_company_id)
    and s.name like 'integracao:%:' || p_company_id::text || ':%';
$fn$;

revoke execute on function public.integration_secrets_status(uuid) from public, anon;
grant execute on function public.integration_secrets_status(uuid) to authenticated;

-- ------------------------------------------------- migração dos valores ----
-- Copia o que já existe em texto puro para o cofre, antes de revogar e limpar.

do $mig$
declare r record;
begin
  -- Asaas
  for r in select company_id, api_key_production, api_key_sandbox, webhook_auth_token
             from public.company_asaas_config loop
    if coalesce(r.api_key_production,'') <> '' then
      perform vault.create_secret(r.api_key_production,
        'integracao:asaas:'||r.company_id::text||':api_key_production','Credencial de integração'); end if;
    if coalesce(r.api_key_sandbox,'') <> '' then
      perform vault.create_secret(r.api_key_sandbox,
        'integracao:asaas:'||r.company_id::text||':api_key_sandbox','Credencial de integração'); end if;
    if coalesce(r.webhook_auth_token,'') <> '' then
      perform vault.create_secret(r.webhook_auth_token,
        'integracao:asaas:'||r.company_id::text||':webhook_auth_token','Credencial de integração'); end if;
  end loop;

  -- Banco Inter
  for r in select company_id, client_secret, key_pem from public.inter_config loop
    if coalesce(r.client_secret,'') <> '' then
      perform vault.create_secret(r.client_secret,
        'integracao:inter:'||r.company_id::text||':client_secret','Credencial de integração'); end if;
    if coalesce(r.key_pem,'') <> '' then
      perform vault.create_secret(r.key_pem,
        'integracao:inter:'||r.company_id::text||':key_pem','Credencial de integração'); end if;
  end loop;

  -- PlugNotas
  for r in select company_id, api_key from public.plugnotas_config loop
    if coalesce(r.api_key,'') <> '' then
      perform vault.create_secret(r.api_key,
        'integracao:plugnotas:'||r.company_id::text||':api_key','Credencial de integração'); end if;
  end loop;

  -- WhatsApp / Evolution
  for r in select company_id, evolution_api_key, webhook_secret from public.whatsapp_configs loop
    if coalesce(r.evolution_api_key,'') <> '' then
      perform vault.create_secret(r.evolution_api_key,
        'integracao:evolution:'||r.company_id::text||':api_key','Credencial de integração'); end if;
    if coalesce(r.webhook_secret,'') <> '' then
      perform vault.create_secret(r.webhook_secret,
        'integracao:evolution:'||r.company_id::text||':webhook_secret','Credencial de integração'); end if;
  end loop;

  -- NFS-e (já protegido do cliente, mas o valor estava em texto puro)
  for r in select company_id, cert_password, worker_api_key from public.nfse_config loop
    if coalesce(r.cert_password,'') <> '' then
      perform vault.create_secret(r.cert_password,
        'integracao:nfse:'||r.company_id::text||':cert_password','Credencial de integração'); end if;
    if coalesce(r.worker_api_key,'') <> '' then
      perform vault.create_secret(r.worker_api_key,
        'integracao:nfse:'||r.company_id::text||':worker_api_key','Credencial de integração'); end if;
  end loop;
end;
$mig$;

-- ------------------------------------------- fecha a leitura pelo cliente ---
-- REVOKE de coluna isolado é no-op quando existe grant de tabela: revogamos a
-- tabela e reconcedemos só as colunas não-secretas.

revoke select on public.company_asaas_config from anon, authenticated;
grant select (id, company_id, environment, webhook_id, webhook_url, webhook_email,
              webhook_send_type, webhook_status, enabled_events, notification_email,
              created_at, updated_at)
  on public.company_asaas_config to anon, authenticated;

revoke select on public.inter_config from anon, authenticated;
grant select (id, company_id, bank_account_id, client_id, cert_pem, account_number,
              environment, active, last_sync_at, last_balance, last_balance_at,
              created_at, updated_at)
  on public.inter_config to anon, authenticated;

revoke select on public.plugnotas_config from anon, authenticated;
grant select (id, company_id, environment, plugnotas_empresa_cnpj, plugnotas_empresa_id,
              enabled_nfe, enabled_nfse, enabled_nfce, enabled_cte, enabled_mdfe,
              serie_padrao, active, last_test_at, last_test_status, last_emission_at,
              created_at, updated_at)
  on public.plugnotas_config to anon, authenticated;

revoke select on public.whatsapp_configs from anon, authenticated;
grant select (id, company_id, instance_name, active, created_at, updated_at,
              evolution_api_url, phone_number, group_jid, group_name, notify_number)
  on public.whatsapp_configs to anon, authenticated;

-- ------------------------------------------------ apaga o texto puro -------
update public.company_asaas_config
   set api_key_production = null, api_key_sandbox = null, webhook_auth_token = null;
update public.inter_config    set client_secret = null, key_pem = null;
update public.plugnotas_config set api_key = null;
update public.whatsapp_configs set evolution_api_key = null, webhook_secret = null;
update public.nfse_config     set cert_password = null, worker_api_key = null;

-- limpeza do cofre quando a empresa é removida: sem FK, o segredo ficaria órfão
create or replace function public.tg_limpar_secrets_da_empresa()
returns trigger language plpgsql security definer set search_path = public, vault as $fn$
begin
  delete from vault.secrets where name like 'integracao:%:' || old.id::text || ':%';
  return old;
end;
$fn$;

drop trigger if exists limpar_secrets_da_empresa on public.companies;
create trigger limpar_secrets_da_empresa
  before delete on public.companies
  for each row execute function public.tg_limpar_secrets_da_empresa();

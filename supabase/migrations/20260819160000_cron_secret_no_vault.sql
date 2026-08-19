-- CRON_SECRET sai do env das edge functions e passa a viver no Vault.
--
-- POR QUE
-- Toda leitura de variável de ambiente numa edge function alimenta a lista de
-- secrets do projeto, que o remix herda e pede ao cliente na importação. O
-- cron secret não é chave de terceiro, é segredo interno: nem UI precisa.
--
-- POR QUE SOB DEMANDA, E NÃO NA MIGRATION
-- O remix copia a ESTRUTURA do banco, não os dados. Um bloco DO de migration
-- que insere um segredo NÃO roda no remix, e o cofre nasceria vazio: o primeiro
-- disparo do cron falharia com "CRON_SECRET não está no Vault". Verificado em
-- remix real (19/08/2026). Por isso o segredo é criado na PRIMEIRA LEITURA.
--
-- NOME
-- 'CRON_SECRET' maiúsculo, o mesmo que public.chamar_funcao_agendada usa para
-- montar o header X-Cron-Secret. Divergir o caso derruba os agendamentos com
-- 403 em silêncio.

-- Cria-se-não-existe e devolve. Idempotente e seguro sob concorrência.
create or replace function public.ensure_cron_secret()
returns text
language plpgsql
security definer
set search_path = public, vault
as $$
declare v_valor text;
begin
  select decrypted_secret into v_valor from vault.decrypted_secrets
   where name = 'CRON_SECRET' limit 1;
  if v_valor is not null and v_valor <> '' then
    return v_valor;
  end if;

  perform vault.create_secret(
    encode(extensions.gen_random_bytes(32), 'hex'),
    'CRON_SECRET',
    'Segredo interno que autoriza as chamadas do pg_cron as edge functions');

  select decrypted_secret into v_valor from vault.decrypted_secrets
   where name = 'CRON_SECRET' limit 1;
  return v_valor;
exception when unique_violation then
  -- corrida entre o agendador e uma edge function: o outro criou primeiro
  select decrypted_secret into v_valor from vault.decrypted_secrets
   where name = 'CRON_SECRET' limit 1;
  return v_valor;
end;
$$;

revoke execute on function public.ensure_cron_secret() from public, anon, authenticated;
grant execute on function public.ensure_cron_secret() to service_role;

-- Leitura usada pelas edge functions (helper _shared/cron.ts).
create or replace function public.get_cron_secret()
returns text
language sql
security definer
set search_path = public, vault
as $$
  select public.ensure_cron_secret();
$$;

revoke execute on function public.get_cron_secret() from public;
revoke execute on function public.get_cron_secret() from anon;
revoke execute on function public.get_cron_secret() from authenticated;
grant execute on function public.get_cron_secret() to service_role;

-- O agendador também provisiona, para o primeiro disparo num remix não falhar.
create or replace function public.chamar_funcao_agendada(p_slug text)
returns bigint
language plpgsql
security definer
set search_path to 'public'
as $$
declare v_secret text; v_base text;
begin
  v_secret := public.ensure_cron_secret();
  if v_secret is null or v_secret = '' then
    raise exception 'Nao foi possivel provisionar o segredo do cron.';
  end if;
  select functions_url into v_base from public.platform_settings where id;
  if v_base is null or v_base = '' then
    raise exception 'O endereco das edge functions desta instalacao nao foi registrado ainda.';
  end if;
  return net.http_post(
    url := v_base || '/' || p_slug,
    headers := jsonb_build_object('Content-Type','application/json','X-Cron-Secret', v_secret),
    body := '{}'::jsonb);
end;
$$;

comment on function public.ensure_cron_secret() is
  'Provisiona e devolve o segredo interno do cron. Criado na primeira leitura porque o remix copia estrutura, nao dados.';

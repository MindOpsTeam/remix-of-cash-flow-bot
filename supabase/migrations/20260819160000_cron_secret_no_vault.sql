-- CRON_SECRET sai do env das edge functions e passa a ser lido do Vault.
--
-- POR QUE
-- Toda leitura de variável de ambiente numa edge function faz o Lovable pedir
-- aquela chave na tela "Update secrets" do remix. Isso trava o cliente logo na
-- importação, antes de ele saber para que serve. Regra da Solução whitelabel:
-- nenhum secret de projeto viaja no remix, e chave de terceiro se configura
-- pela UI. O cron secret não é chave de terceiro, é um segredo interno, então
-- nem UI precisa: ele nasce sozinho, aleatório, um por instalação.
--
-- NOME DO SEGREDO
-- 'CRON_SECRET' (maiúsculo) é o nome que `public.chamar_funcao_agendada` já lê
-- para montar o header X-Cron-Secret. A RPC abaixo lê exatamente o mesmo nome.
-- Divergir o caso quebraria os 8 agendamentos com 403 em silêncio.

-- provisiona o segredo se a instalação ainda não tiver (caso do remix novo)
do $$
declare v_id uuid;
begin
  select id into v_id from vault.secrets where name = 'CRON_SECRET';
  if v_id is null then
    perform vault.create_secret(
      encode(extensions.gen_random_bytes(32), 'hex'),
      'CRON_SECRET',
      'Segredo interno que autoriza as chamadas do pg_cron as edge functions'
    );
  end if;
end $$;

-- leitura para as edge functions: só o service_role executa
create or replace function public.get_cron_secret()
returns text
language sql
stable
security definer
set search_path = public, vault
as $$
  select decrypted_secret from vault.decrypted_secrets where name = 'CRON_SECRET' limit 1;
$$;

revoke execute on function public.get_cron_secret() from public;
revoke execute on function public.get_cron_secret() from anon;
revoke execute on function public.get_cron_secret() from authenticated;
grant execute on function public.get_cron_secret() to service_role;

comment on function public.get_cron_secret() is
  'Segredo interno do cron, lido do Vault. Só service_role executa. Substitui a variável de ambiente CRON_SECRET, que fazia o Lovable pedir o valor na importação do remix.';

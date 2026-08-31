-- ═══════════════════════════════════════════════════════════════════════════
-- WEBHOOK DE SAÍDA
--
-- O FinanceAI só RECEBIA webhook (`webhook-receiver`). Nada saía daqui: quem
-- quisesse saber de um lançamento novo tinha de perguntar de tempos em tempos.
-- Para o Gestor de Tráfego, que lê de 4 em 4 horas, isso significa que o
-- faturamento de hoje aparece amanhã na tela do cliente.
--
-- ─── TRÊS DECISÕES ─────────────────────────────────────────────────────────
--
-- 1. **O SEGREDO ASSINA; A URL NÃO IDENTIFICA.** HMAC-SHA256 sobre o corpo
--    cru, no cabeçalho `x-financeai-signature`. É o mesmo esquema de Stripe e
--    Asaas, então quem recebe já sabe verificar. URL secreta sozinha vaza no
--    log de qualquer proxy no caminho e não prova origem nenhuma.
--
-- 2. **A FILA É TABELA, NÃO MEMÓRIA.** Destino fora do ar não pode custar um
--    lançamento: ele fica pendente e sai na próxima drenagem. Entrega é
--    pelo-menos-uma-vez, e quem recebe deduplica pelo id da transação — que
--    vai no corpo justamente para isso.
--
-- 3. **FALHA SEGUIDA DESLIGA.** Sem teto, um destino morto gera uma tentativa
--    por minuto para sempre, e a conta de egress é de quem hospeda o ERP. Dez
--    falhas seguidas desligam, e o motivo fica na linha para a tela mostrar.
--
-- ─── O QUE NÃO SAI ─────────────────────────────────────────────────────────
--
-- Despesa e faturamento entre empresas do mesmo grupo NÃO são enfileirados. O
-- destinatário descartaria de qualquer forma, e mandar seria gastar entrega
-- para nada — além de expor o custo interno do cliente para fora do ERP sem
-- que ninguém tenha pedido.
-- ═══════════════════════════════════════════════════════════════════════════

create table if not exists public.webhooks_saida (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  url text not null,
  -- Assina o corpo. Nunca chega ao browser: a tela lê pela view abaixo.
  segredo text not null,
  eventos text[] not null default array['transaction.confirmed','transaction.reconciled'],
  ativo boolean not null default true,
  ultima_entrega_em timestamptz,
  falhas_seguidas integer not null default 0,
  ultimo_erro text,
  created_at timestamptz not null default now()
);

create table if not exists public.webhooks_fila (
  id uuid primary key default gen_random_uuid(),
  webhook_id uuid not null references public.webhooks_saida(id) on delete cascade,
  evento text not null,
  payload jsonb not null,
  criado_em timestamptz not null default now(),
  entregue_em timestamptz,
  tentativas integer not null default 0,
  ultimo_erro text
);

create index if not exists idx_webhooks_fila_pendentes
  on public.webhooks_fila (criado_em) where entregue_em is null;

alter table public.webhooks_saida enable row level security;
alter table public.webhooks_fila  enable row level security;
revoke all on public.webhooks_saida from anon, authenticated;
revoke all on public.webhooks_fila  from anon, authenticated;

drop policy if exists ws_service on public.webhooks_saida;
create policy ws_service on public.webhooks_saida for all to service_role
  using (true) with check (true);
drop policy if exists wf_service on public.webhooks_fila;
create policy wf_service on public.webhooks_fila for all to service_role
  using (true) with check (true);

-- A tela lê por aqui: tudo menos o segredo. `revoke select (coluna)` é no-op
-- quando existe grant de tabela, então a view é a proteção real.
create or replace view public.webhooks_saida_visiveis
with (security_invoker = true) as
select w.id, w.company_id, w.url, w.eventos, w.ativo,
       w.ultima_entrega_em, w.falhas_seguidas, w.ultimo_erro, w.created_at
  from public.webhooks_saida w
 where public.is_company_member(w.company_id);

revoke all on public.webhooks_saida_visiveis from anon;
grant select on public.webhooks_saida_visiveis to authenticated;


-- ─── O gatilho ─────────────────────────────────────────────────────────────

create or replace function public.enfileirar_webhook_de_lancamento()
returns trigger language plpgsql security definer set search_path = public as $$
declare _w record; _evento text;
begin
  -- Despesa e repasse interno não interessam a quem mede receita, e mandar
  -- expõe o custo do cliente para fora do ERP sem necessidade.
  if new.type <> 'revenue' or coalesce(new.is_intercompany, false) then
    return new;
  end if;

  _evento := 'transaction.' || new.status;

  for _w in
    select id from public.webhooks_saida
     where company_id = new.company_id and ativo and _evento = any(eventos)
  loop
    insert into public.webhooks_fila (webhook_id, evento, payload)
    values (_w.id, _evento, jsonb_build_object(
      'evento', _evento,
      'company_id', new.company_id,
      'enviado_em', now(),
      'transaction', jsonb_build_object(
        'id', new.id,
        'date', new.date,
        'description', new.description,
        'amount', new.amount,
        'type', new.type,
        'status', new.status,
        'payment_method', new.payment_method,
        'is_intercompany', coalesce(new.is_intercompany, false)
      )
    ));
  end loop;

  return new;
end $$;

drop trigger if exists trg_webhook_de_lancamento on public.transactions;
create trigger trg_webhook_de_lancamento
  after insert or update of status on public.transactions
  for each row execute function public.enfileirar_webhook_de_lancamento();

comment on table public.webhooks_saida is
  'Destinos que recebem lançamento de receita em tempo real. O corpo é assinado com HMAC-SHA256 em `x-financeai-signature`.';


-- ─── A drenagem ────────────────────────────────────────────────────────────
--
-- A cada minuto. Diferente dos outros trabalhos deste banco, aqui o atraso é o
-- ponto: o webhook existe justamente para o destino saber AGORA. Um evento por
-- minuto no pior caso é barato; o lote de 50 cobre picos sem estourar o tempo
-- da função.
--
-- `net.http_post` é assíncrono e não trava a transação — a fila continua
-- drenando mesmo que um destino esteja lento.

create or replace function public.drenar_webhooks_de_saida()
returns bigint language plpgsql security definer set search_path = public as $$
declare _url text; _segredo text; _req_id bigint;
begin
  select decrypted_secret into _segredo
    from vault.decrypted_secrets where name = 'cron_secret' limit 1;
  select decrypted_secret into _url
    from vault.decrypted_secrets where name = 'supabase_functions_url' limit 1;

  if _url is null or _segredo is null then
    raise notice 'drenar_webhooks_de_saida: falta supabase_functions_url ou cron_secret no Vault';
    return null;
  end if;

  -- Nada pendente, nada a fazer: sem esta guarda, o cron acorda a função 1.440
  -- vezes por dia num banco onde ninguém cadastrou webhook nenhum.
  if not exists (select 1 from public.webhooks_fila where entregue_em is null) then
    return null;
  end if;

  select net.http_post(
    url := _url || '/webhook-dispatch',
    body := '{}'::jsonb,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', _segredo),
    timeout_milliseconds := 30000
  ) into _req_id;

  return _req_id;
end $$;

revoke all on function public.drenar_webhooks_de_saida() from public, anon, authenticated;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule('webhooks-saida')
      where exists (select 1 from cron.job where jobname = 'webhooks-saida');
    perform cron.schedule('webhooks-saida', '* * * * *',
      'SELECT public.drenar_webhooks_de_saida()');
  end if;
end;
$$;

-- Acurácia das previsões: guarda o que foi previsto e compara com o que veio.
--
-- POR QUE
-- Sem isto, "o sistema prevê" é fé. O número que transforma projeção em
-- ferramenta de decisão é "ele errou X% nas últimas N previsões DESTA empresa".
-- Também permite provar qual motor (TimesFM, sazonal, estatístico) acerta mais
-- em cada operação, em vez de escolher por preferência.

create table if not exists public.forecast_snapshots (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  gerado_em date not null default current_date,
  mes_alvo text not null,                          -- YYYY-MM previsto
  motor text not null,                             -- timesfm | sazonal | estatistico
  receita_prevista numeric(14,2) not null,
  despesa_prevista numeric(14,2) not null,
  p10_receita numeric(14,2),
  p90_receita numeric(14,2),
  created_at timestamptz not null default now(),
  -- um por dia por mês alvo: refresh de tela não infla a tabela
  unique (company_id, gerado_em, mes_alvo)
);
create index if not exists forecast_snapshots_avaliar_idx
  on public.forecast_snapshots (company_id, mes_alvo);

create table if not exists public.forecast_accuracy (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  mes_alvo text not null,
  motor text not null,
  receita_prevista numeric(14,2) not null,
  receita_real numeric(14,2) not null,
  despesa_prevista numeric(14,2) not null,
  despesa_real numeric(14,2) not null,
  dentro_da_banda boolean,
  avaliado_em date not null default current_date,
  unique (company_id, mes_alvo, motor)
);
create index if not exists forecast_accuracy_empresa_idx
  on public.forecast_accuracy (company_id, mes_alvo desc);

alter table public.forecast_snapshots enable row level security;
alter table public.forecast_accuracy  enable row level security;

-- membros LEEM; escrita é do servidor (as edges rodam com service_role, que
-- ignora RLS). Sem policy de insert para authenticated: previsão gravada pelo
-- cliente permitiria maquiar a própria acurácia.
create policy "membros leem snapshots" on public.forecast_snapshots
  for select to authenticated using (public.is_company_member(company_id));
create policy "membros leem acuracia" on public.forecast_accuracy
  for select to authenticated using (public.is_company_member(company_id));

-- Avaliacao de acuracia: compara o que foi PREVISTO antes do mes comecar com o
-- que de fato aconteceu.
--
-- POR QUE EM SQL E NAO NUMA EDGE FUNCTION
-- E trabalho de dado puro, sem chamada externa. Em SQL ele sobe junto com a
-- migration (o gitsync nao deploya edge function), roda dentro do banco e nao
-- depende de chave nenhuma para funcionar.
--
-- REGRA QUE FAZ O NUMERO SER HONESTO
-- So vale o snapshot gerado ANTES do primeiro dia do mes-alvo. Previsao feita
-- no dia 28 do proprio mes acerta sempre e nao mede nada.
create or replace function public.avaliar_acuracia_forecast()
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_inseridos integer;
begin
  with candidatos as (
    select distinct on (s.company_id, s.mes_alvo)
      s.company_id, s.mes_alvo, s.motor,
      s.receita_prevista, s.despesa_prevista, s.p10_receita, s.p90_receita
    from public.forecast_snapshots s
    where s.mes_alvo < to_char(current_date, 'YYYY-MM')
      and s.gerado_em < to_date(s.mes_alvo || '-01', 'YYYY-MM-DD')
    order by s.company_id, s.mes_alvo, s.gerado_em desc
  ),
  comparado as (
    select c.*, f.receita as receita_real, f.despesa as despesa_real
    from candidatos c
    join public.v_fluxo_mensal f
      on f.company_id = c.company_id and f.mes = c.mes_alvo
  )
  insert into public.forecast_accuracy (
    company_id, mes_alvo, motor,
    receita_prevista, receita_real, despesa_prevista, despesa_real,
    dentro_da_banda, avaliado_em
  )
  select company_id, mes_alvo, motor,
    receita_prevista, receita_real, despesa_prevista, despesa_real,
    case when p10_receita is null or p90_receita is null then null
         else receita_real between p10_receita and p90_receita end,
    current_date
  from comparado
  on conflict (company_id, mes_alvo, motor) do update set
    receita_prevista = excluded.receita_prevista,
    receita_real     = excluded.receita_real,
    despesa_prevista = excluded.despesa_prevista,
    despesa_real     = excluded.despesa_real,
    dentro_da_banda  = excluded.dentro_da_banda,
    avaliado_em      = excluded.avaliado_em;

  get diagnostics v_inseridos = row_count;
  return v_inseridos;
end;
$$;

-- Trabalho de sistema: ninguem chama isso pela API.
revoke all on function public.avaliar_acuracia_forecast() from public, anon, authenticated;

comment on function public.avaliar_acuracia_forecast() is
  'Compara previsao out-of-sample com o realizado e alimenta forecast_accuracy. Roda no cron diario.';

-- Agenda: 10h05 UTC, antes do smart-alerts das 11h, para o alerta ja poder
-- citar a precisao medida.
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule('forecast-accuracy-daily')
      where exists (select 1 from cron.job where jobname = 'forecast-accuracy-daily');
    perform cron.schedule('forecast-accuracy-daily', '5 10 * * *',
      'SELECT public.avaliar_acuracia_forecast()');
  end if;
end;
$$;

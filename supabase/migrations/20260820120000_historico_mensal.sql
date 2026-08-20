-- Historico mensal agregado, para a projecao enxergar mais de 6 meses sem
-- carregar milhares de linhas de transacao dentro da edge function.
--
-- POR QUE
-- A sazonalidade so existe com dois ciclos completos (24 meses). Hoje a
-- ai-forecast le 6 meses de transacoes linha a linha, porque precisa da
-- descricao para o texto da IA. Puxar 36 meses de linha crua para calcular uma
-- media seria caro e lento. Esta view devolve 36 numeros.
--
-- A janela de 6 meses da narrativa NAO muda: esta view alimenta apenas as
-- camadas novas (sazonalidade e banda de incerteza).
create or replace view public.v_fluxo_mensal
with (security_invoker = on) as
select
  t.company_id,
  to_char(t.date, 'YYYY-MM') as mes,
  sum(case when t.type = 'revenue' then t.amount else 0 end)::numeric(14,2) as receita,
  sum(case when t.type <> 'revenue' then t.amount else 0 end)::numeric(14,2) as despesa,
  count(*)::int as lancamentos
from public.transactions t
where t.status = 'confirmed'
group by t.company_id, to_char(t.date, 'YYYY-MM');

comment on view public.v_fluxo_mensal is
  'Receita e despesa confirmadas por mes e empresa. Base das camadas de sazonalidade e banda de incerteza.';

-- Recompra robusta: mediana dos intervalos REAIS entre compras consecutivas.
--
-- POR QUE UMA VIEW NOVA E NAO UM ALTER NA EXISTENTE
-- v_recompra_clientes continua existindo, com a mesma assinatura e os mesmos
-- cortes. Telas, alertas e qualquer coisa que ja consome nao mudam de
-- comportamento. Esta view fica AO LADO, para quem quiser o numero robusto.
--
-- A view antiga calcula (ultima - primeira) / (n - 1), que e media: uma unica
-- compra atipica desloca o intervalo inteiro e move o cliente de faixa sem que
-- nada tenha mudado no comportamento dele. A mediana ignora o outlier.
create or replace view public.v_recompra_robusta
with (security_invoker = on) as
with intervalos as (
  select
    so.contact_id,
    so.issue_date - lag(so.issue_date) over (partition by so.contact_id order by so.issue_date) as dias
  from public.sales_orders so
  where so.status <> 'cancelled'
),
agregado as (
  select contact_id,
    percentile_cont(0.5) within group (order by dias)::numeric as intervalo_mediano,
    stddev_pop(dias)::numeric as desvio_dias,
    count(*)::int as n_intervalos
  from intervalos where dias is not null and dias > 0
  group by contact_id
)
select
  c.id as contact_id,
  c.company_id,
  c.name,
  a.n_intervalos,
  round(a.intervalo_mediano)::int as intervalo_mediano_dias,
  round(coalesce(a.desvio_dias, 0))::int as desvio_dias,
  o.n_compras,
  o.ultima_compra,
  case when o.n_compras > 0 then round(o.total_gasto / o.n_compras, 2) end as ticket_medio,
  (current_date - o.ultima_compra) as dias_desde_ultima,
  case when a.intervalo_mediano > 0
    then o.ultima_compra + round(a.intervalo_mediano)::int end as proxima_esperada,
  -- mesmos cortes da view original, para a leitura do usuario nao mudar de regua
  case
    when a.n_intervalos < 2 or a.intervalo_mediano is null or a.intervalo_mediano <= 0 then 'novo'
    when (current_date - o.ultima_compra)::numeric / a.intervalo_mediano < 0.8 then 'em_dia'
    when (current_date - o.ultima_compra)::numeric / a.intervalo_mediano < 1.25 then 'previsto'
    when (current_date - o.ultima_compra)::numeric / a.intervalo_mediano < 2 then 'atrasado'
    else 'perdido'
  end as status
from public.contacts c
join agregado a on a.contact_id = c.id
join lateral (
  select count(*) as n_compras, max(so.issue_date) as ultima_compra,
         coalesce(sum(so.total), 0) as total_gasto
  from public.sales_orders so
  where so.contact_id = c.id and so.status <> 'cancelled'
) o on o.n_compras > 0
where c.active = true;

comment on view public.v_recompra_robusta is
  'Intervalo tipico de recompra pela mediana dos intervalos reais. Convive com v_recompra_clientes (media), que segue intacta.';

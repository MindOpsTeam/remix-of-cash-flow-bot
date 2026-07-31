-- O Open Finance passa a se atualizar sozinho.
--
-- O webhook da Pluggy cobre o push quando o banco notifica; este job cobre o
-- resto: conexões sem webhook, drift de consentimento e o dia em que o push
-- simplesmente não veio. Mesmo padrão dos demais agendamentos versionados
-- (20260728090000): o segredo fica no Vault, o job só conhece o slug.
--
-- Horário: 08h30 UTC (05h30 BRT), antes dos agentes do meio-dia, para que a
-- cobrança e a anomalia enxerguem o extrato do dia.

SELECT cron.schedule(
  'openfinance-sync-daily',
  '30 8 * * *',
  $$SELECT public.chamar_funcao_agendada('openfinance-sync')$$
);

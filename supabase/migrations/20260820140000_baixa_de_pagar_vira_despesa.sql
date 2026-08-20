-- Pagar conta e pagar imposto precisam virar DESPESA no DRE.
--
-- O DEFEITO
-- Do lado da receita, dar baixa num recebivel ja criava a linha em
-- `transactions` e o DRE via a entrada. Do lado da despesa, marcar conta como
-- paga so mudava o status: a despesa nunca virava lancamento. Como
-- `v_dre_linhas` le exclusivamente `transactions`, o dono pagava o mes inteiro
-- pela tela e via receita cheia com despesa quase zero. Lucro que nao existe,
-- na tela que ele leva para o contador.
--
-- Guia de imposto tinha o mesmo buraco, e sem nem ter onde guardar o vinculo.

alter table public.tax_guides
  add column if not exists transaction_id uuid references public.transactions(id) on delete set null,
  add column if not exists payment_date date;

comment on column public.tax_guides.transaction_id is
  'Lancamento de despesa gerado na baixa. Sem ele o imposto pago nao aparece no DRE.';

-- ── A REDE DE SEGURANCA
-- Consertar a tela nao basta: Asaas, cron e importacao tambem dao baixa. Estas
-- duas regras acusam o elo partido venha ele de onde vier.
--
-- POR QUE PATCH E NAO CREATE OR REPLACE INTEIRO
-- A funcao tem 10 regras. Redigitar as 10 para acrescentar 2 e exatamente como
-- uma regra some sem ninguem ver: aconteceu na primeira tentativa desta
-- migration, duas regras evaporaram na transcricao. Aqui partimos da definicao
-- viva e so inserimos os blocos novos antes do RETURN final.
do $outer$
declare
  v_def text;
  v_novas text := $novas$
  -- 11) Conta a pagar marcada como paga que nao virou despesa.
  RETURN QUERY
  SELECT 'erro', 'conta_paga_sem_lancamento',
         'Conta a pagar marcada como paga sem lançamento de despesa correspondente. O DRE está mostrando lucro maior do que o real.',
         count(*), min(coalesce(b.descricao, b.fornecedor))
  FROM public.bills_payable b
  WHERE b.company_id = p_company_id
    AND b.status = 'pago'
    AND b.transaction_id IS NULL
  HAVING count(*) > 0;

  -- 12) Guia de imposto paga que nao virou despesa.
  RETURN QUERY
  SELECT 'erro', 'guia_paga_sem_lancamento',
         'Guia de imposto marcada como paga sem lançamento de despesa correspondente.',
         count(*), min(g.tipo || ' ' || g.competencia)
  FROM public.tax_guides g
  WHERE g.company_id = p_company_id
    AND g.status = 'pago'
    AND g.transaction_id IS NULL
  HAVING count(*) > 0;

  RETURN;
$novas$;
begin
  v_def := pg_get_functiondef('public.auditar_integridade_contabil(uuid)'::regprocedure);

  if position('conta_paga_sem_lancamento' in v_def) > 0 then
    raise notice 'regras ja presentes, nada a fazer';
    return;
  end if;

  v_def := regexp_replace(v_def, '\n\s*RETURN;\s*\nEND;', v_novas || E'\nEND;');
  execute v_def;
end;
$outer$;

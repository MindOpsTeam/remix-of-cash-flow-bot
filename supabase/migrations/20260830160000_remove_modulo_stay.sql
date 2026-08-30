-- Remove o módulo STAY (hospedagem por temporada).
--
-- Ele entrou em 27/08 por prompt de terceiro no projeto ORIGINAL, junto com o
-- rebrand do produto para "STAY" e uma semente de imóveis reais em Goiânia. É o
-- negócio de outra pessoa dentro do template. O rollback do Lovable desfez o
-- código e não tocou no banco, porque rollback é do repositório: as sete tabelas
-- continuaram de pé, com RLS e triggers, prontas para viajar em todo remix.
--
-- A migration que as criou foi removida no mesmo commit, então um remix novo
-- nunca as cria e este arquivo é no-op lá. Aqui, no banco original, ele limpa.
--
-- As sete estavam VAZIAS (0 linhas em cada, conferido antes) e nenhuma tabela de
-- fora aponta para elas — por isso o DROP não perde dado nem quebra referência.
-- Mesmo assim vai sem CASCADE nas funções e com a ordem de dependência explícita
-- nas tabelas: se um dia sobrar algo pendurado, é melhor a migration falhar e
-- alguém olhar do que apagar em silêncio o que não estava no plano.

DROP TRIGGER IF EXISTS trg_stay_reservations_calc ON public.stay_reservations;

DROP TABLE IF EXISTS public.stay_owner_statements;
DROP TABLE IF EXISTS public.stay_reservation_items;
DROP TABLE IF EXISTS public.stay_reservations;
DROP TABLE IF EXISTS public.stay_fee_types;
DROP TABLE IF EXISTS public.stay_channels;
DROP TABLE IF EXISTS public.stay_units;
DROP TABLE IF EXISTS public.stay_properties;

DROP FUNCTION IF EXISTS public.stay_semear_cadastros(uuid);
DROP FUNCTION IF EXISTS public.stay_calcular_reserva();

-- Prova: se sobrar qualquer objeto stay_ no schema, a migration falha em vez de
-- terminar "com sucesso" deixando resíduo — o mesmo erro que deixou essas
-- tabelas vivas depois do rollback.
DO $$
DECLARE v_resto text;
BEGIN
  SELECT string_agg(nome, ', ') INTO v_resto
  FROM (
    SELECT c.relname AS nome
      FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = 'public' AND c.relkind IN ('r','v','m') AND c.relname LIKE 'stay\_%'
    UNION ALL
    SELECT p.proname
      FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public' AND p.proname LIKE 'stay\_%'
  ) s;

  IF v_resto IS NOT NULL THEN
    RAISE EXCEPTION 'Módulo STAY não saiu por inteiro; sobrou: %', v_resto;
  END IF;
END $$;

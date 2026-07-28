-- Índices econômicos, da fonte oficial.
--
-- Eu tinha deixado o reajuste pedindo o percentual ao usuário, com o argumento
-- de que inventar IPCA seria o mesmo erro de escrever cClassTrib à mão. O
-- argumento continua certo, mas a conclusão estava preguiçosa: o Banco Central
-- publica as séries numa API pública e gratuita, então dava para buscar na
-- fonte em vez de perguntar.
--
--   IPCA  -> série 433
--   IGP-M -> série 189
--   INPC  -> série 188
--
-- A tabela guarda a variação MENSAL, que é o que a fonte entrega. O acumulado
-- de doze meses é calculado por composição, não por soma: somar 12 variações
-- mensais erra para menos e a diferença aparece justamente nos anos de
-- inflação alta, que são os anos em que o reajuste importa.
--
-- `fonte` e `atualizado_em` ficam gravados por linha. Número de índice sem
-- procedência é chute com cara de dado.

CREATE TABLE IF NOT EXISTS public.indices_economicos (
  indice text NOT NULL CHECK (indice IN ('ipca', 'igpm', 'inpc')),
  mes date NOT NULL,
  variacao_pct numeric(8,4) NOT NULL,
  fonte text NOT NULL DEFAULT 'bcb-sgs',
  atualizado_em timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (indice, mes)
);

ALTER TABLE public.indices_economicos ENABLE ROW LEVEL SECURITY;

-- Domínio público: mesma tabela para todas as empresas, leitura para quem está
-- autenticado, escrita só pelo sincronizador com service_role.
DROP POLICY IF EXISTS "Autenticado le indices" ON public.indices_economicos;
CREATE POLICY "Autenticado le indices" ON public.indices_economicos
  FOR SELECT TO authenticated USING (true);

REVOKE ALL ON public.indices_economicos FROM anon, authenticated;
GRANT SELECT ON public.indices_economicos TO authenticated;

COMMENT ON TABLE public.indices_economicos IS
  'Variação mensal de IPCA, IGP-M e INPC, buscada da API pública do Banco Central (SGS).';

/**
 * Acumulado do índice entre dois meses, por composição.
 *
 * Devolve NULL quando falta mês na janela, e isso é de propósito: acumulado
 * calculado sobre série incompleta dá um número menor e plausível, que é o
 * pior tipo de erro. Melhor não responder do que responder baixo.
 */
CREATE OR REPLACE FUNCTION public.acumulado_indice(
  p_indice text,
  p_de date,
  p_ate date
)
RETURNS numeric
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_fator numeric := 1;
  v_meses integer;
  v_encontrados integer;
  r record;
BEGIN
  IF p_indice IS NULL OR p_de IS NULL OR p_ate IS NULL OR p_de > p_ate THEN
    RETURN NULL;
  END IF;

  v_meses := (date_part('year', age(date_trunc('month', p_ate), date_trunc('month', p_de))) * 12
            + date_part('month', age(date_trunc('month', p_ate), date_trunc('month', p_de))))::integer + 1;

  SELECT count(*) INTO v_encontrados
    FROM public.indices_economicos
   WHERE indice = p_indice
     AND mes >= date_trunc('month', p_de)::date
     AND mes <= date_trunc('month', p_ate)::date;

  IF v_encontrados < v_meses THEN
    RETURN NULL;
  END IF;

  FOR r IN
    SELECT variacao_pct FROM public.indices_economicos
     WHERE indice = p_indice
       AND mes >= date_trunc('month', p_de)::date
       AND mes <= date_trunc('month', p_ate)::date
     ORDER BY mes
  LOOP
    v_fator := v_fator * (1 + r.variacao_pct / 100);
  END LOOP;

  RETURN round((v_fator - 1) * 100, 3);
END;
$$;

REVOKE ALL ON FUNCTION public.acumulado_indice(text, date, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.acumulado_indice(text, date, date) TO authenticated;

COMMENT ON FUNCTION public.acumulado_indice(text, date, date) IS
  'Acumulado do índice no período, por composição. NULL quando a série está incompleta.';

-- A fila de reajuste passa a trazer o percentual já calculado.
-- CREATE OR REPLACE não aceita coluna nova no meio da lista, então recria.
DROP VIEW IF EXISTS public.v_contratos_a_reajustar;
CREATE VIEW public.v_contratos_a_reajustar
WITH (security_invoker = on) AS
 SELECT
    c.id,
    c.company_id,
    c.description,
    c.contact_id,
    ct.name AS contato_nome,
    c.amount AS valor_atual,
    c.indice_reajuste,
    c.percentual_reajuste,
    c.proximo_reajuste,
    c.ultimo_reajuste_em,
    (c.proximo_reajuste - current_date) AS dias_para_aniversario,
    -- Percentual combinado manda; senão, o acumulado de doze meses do índice
    -- até o mês anterior ao aniversário, que é a janela usual de reajuste.
    CASE
      WHEN c.indice_reajuste = 'fixo' THEN c.percentual_reajuste
      ELSE public.acumulado_indice(
             c.indice_reajuste,
             (date_trunc('month', c.proximo_reajuste) - interval '12 months')::date,
             (date_trunc('month', c.proximo_reajuste) - interval '1 month')::date)
    END AS percentual_sugerido,
    (c.indice_reajuste = 'fixo' AND c.percentual_reajuste IS NOT NULL) AS aplica_sozinho
   FROM public.contracts c
   LEFT JOIN public.contacts ct ON ct.id = c.contact_id
  WHERE c.status = 'active'
    AND c.proximo_reajuste IS NOT NULL
    AND COALESCE(c.indice_reajuste, 'nenhum') <> 'nenhum'
    AND c.proximo_reajuste <= current_date + 30;

REVOKE ALL ON public.v_contratos_a_reajustar FROM anon;
GRANT SELECT ON public.v_contratos_a_reajustar TO authenticated;

-- Sincronismo mensal, no dia 12, que é depois da divulgação do IPCA do mês
-- anterior pelo IBGE.
SELECT cron.schedule('indices-sync-mensal', '0 5 12 * *',
  $$SELECT public.chamar_funcao_agendada('indices-sync')$$);

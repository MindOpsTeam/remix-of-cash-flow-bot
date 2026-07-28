-- Carga da tabela oficial de cClassTrib, da fonte.
--
-- Achado que destravou isto: a tabela não está numa planilha para baixar. Ela é
-- publicada pelo SVRS no Portal da Conformidade Fácil, em
-- https://dfe-portal.svrs.rs.gov.br/CFF/ClassificacaoTributaria, e vem embutida
-- na própria página, num array JavaScript chamado `dadosOriginais`. Por isso
-- procurar por "planilha da NT" não achava nada.
--
-- Quem busca é o BANCO, via pg_net, e não eu copiando e colando. Assim o dado
-- não passa por nenhum intermediário que possa alterá-lo, e a procedência fica
-- verificável: a mesma migration que carrega é a que diz de onde veio.
--
-- A extração é feita em SQL a partir do HTML porque não existe endpoint JSON
-- nem arquivo para download. Se o SVRS publicar um um dia, esta migration é o
-- único lugar a mudar.
--
-- Uma cópia versionada do resultado fica em supabase/seed/cclasstrib.json, para
-- o caso de o portal sair do ar quando alguém subir um ambiente novo.

DO $$
DECLARE
  v_req bigint;
  v_content text;
  v_json jsonb;
  v_linhas jsonb;
  v_tentativas integer := 0;
BEGIN
  -- Já carregada? Não repete. Recarregar é ato deliberado, via
  -- public.carregar_cclasstrib(), e não efeito de rodar migration de novo.
  IF EXISTS (SELECT 1 FROM public.cclasstrib_codigos) THEN
    RAISE NOTICE 'cclasstrib_codigos já tem conteúdo; carga ignorada.';
    RETURN;
  END IF;

  SELECT net.http_get(
    url := 'https://dfe-portal.svrs.rs.gov.br/CFF/ClassificacaoTributaria',
    headers := jsonb_build_object('Accept', 'text/html')
  ) INTO v_req;

  -- pg_net é assíncrono: a resposta aparece depois. Espera curta e limitada,
  -- porque migration que trava indefinidamente é pior que migration que falha.
  WHILE v_tentativas < 30 LOOP
    PERFORM pg_sleep(1);
    v_tentativas := v_tentativas + 1;
    SELECT content INTO v_content FROM net._http_response
     WHERE id = v_req AND status_code = 200;
    EXIT WHEN v_content IS NOT NULL;
  END LOOP;

  IF v_content IS NULL THEN
    RAISE WARNING 'Não consegui baixar a tabela de cClassTrib do SVRS. Carregue depois com public.carregar_cclasstrib() usando supabase/seed/cclasstrib.json.';
    RETURN;
  END IF;

  -- O array vive depois do identificador `dadosOriginais` e termina no `];`.
  v_json := left(
    substring(substring(v_content from position('dadosOriginais' in v_content))
              from position('[' in substring(v_content from position('dadosOriginais' in v_content)))),
    position('];' in substring(substring(v_content from position('dadosOriginais' in v_content))
              from position('[' in substring(v_content from position('dadosOriginais' in v_content)))))
  )::jsonb;

  -- Cada CST traz suas classificações. Um mesmo cClassTrib pode aparecer em
  -- mais de um CST, então os CSTs são agregados por código.
  WITH pares AS (
    SELECT ct ->> 'CodClassTrib' AS codigo,
           btrim(ct ->> 'NomeClassTrib') AS descricao,
           cst ->> 'Cst' AS cst
      FROM jsonb_array_elements(v_json) cst,
           jsonb_array_elements(COALESCE(cst -> 'ClassificacoesTributarias', '[]'::jsonb)) ct
     WHERE ct ->> 'CodClassTrib' IS NOT NULL
  ),
  agrupado AS (
    SELECT codigo,
           (array_agg(descricao ORDER BY length(descricao) DESC))[1] AS descricao,
           array_agg(DISTINCT cst ORDER BY cst) AS cst
      FROM pares
     WHERE descricao IS NOT NULL AND descricao <> ''
     GROUP BY codigo
  )
  SELECT jsonb_agg(jsonb_build_object('codigo', codigo, 'descricao', descricao, 'cst', to_jsonb(cst))
                   ORDER BY codigo)
    INTO v_linhas
    FROM agrupado;

  PERFORM public.carregar_cclasstrib(
    v_linhas,
    'SVRS Conformidade Facil - Classificacao Tributaria, publicacao 22/06/2026'
  );

  RAISE NOTICE 'cClassTrib carregada: % códigos.', jsonb_array_length(v_linhas);
END;
$$;

-- Carga da tabela oficial de cClassTrib.
--
-- `cclasstrib_codigos` nasceu vazia de propósito: o conselho foi explícito em
-- que a validação deve ser CARREGADA da planilha versionada e nunca escrita à
-- mão no código. Enquanto ela estiver vazia, `sugerir-fiscal` devolve
-- `tabela_oficial: false` e a IA se recusa a propor o código.
--
-- Esta migration não inventa nenhum código. Ela cria o caminho de carga, para
-- que ter a planilha em mãos vire um comando só, em vez de virar uma sessão de
-- engenharia. É a diferença entre "bloqueado" e "faltando um arquivo".
--
-- COMO USAR, quando a planilha da NT estiver em mãos:
--
--   SELECT public.carregar_cclasstrib(
--     '[{"codigo":"000001","descricao":"Tributação integral","cst":["000"]}, ...]'::jsonb,
--     'NT 2025.002 v1.10'
--   );
--
-- A versão fica gravada em cada linha, então dá para saber depois qual layout
-- a empresa estava usando quando emitiu.

/**
 * Substitui a tabela inteira pelo conteúdo da planilha oficial.
 *
 * Substituição total, e não merge, porque a NT publica a tabela COMPLETA a cada
 * revisão. Merge deixaria código revogado vivo, e código revogado que continua
 * validando é pior do que código faltando: ele deixa a nota sair errada.
 *
 * Só service_role executa. Tabela de domínio fiscal não se edita pela tela.
 */
CREATE OR REPLACE FUNCTION public.carregar_cclasstrib(p_linhas jsonb, p_versao text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total integer;
  v_invalidos integer;
  v_antes integer;
BEGIN
  IF p_linhas IS NULL OR jsonb_typeof(p_linhas) <> 'array' OR jsonb_array_length(p_linhas) = 0 THEN
    RAISE EXCEPTION 'Passe a planilha como array JSON não vazio.' USING ERRCODE = '23514';
  END IF;

  IF coalesce(trim(p_versao), '') = '' THEN
    RAISE EXCEPTION 'Informe a versão da NT. Tabela fiscal sem versão não é auditável.'
      USING ERRCODE = '23514';
  END IF;

  -- Formato antes de conteúdo: cClassTrib tem 6 dígitos. Linha fora do formato
  -- indica planilha errada ou coluna trocada, e carregar mesmo assim
  -- contaminaria a validação de todas as empresas de uma vez.
  SELECT count(*) INTO v_invalidos
    FROM jsonb_array_elements(p_linhas) e
   WHERE coalesce(e ->> 'codigo', '') !~ '^[0-9]{6}$'
      OR coalesce(trim(e ->> 'descricao'), '') = '';

  IF v_invalidos > 0 THEN
    RAISE EXCEPTION 'A planilha tem % linha(s) com código fora do formato de 6 dígitos ou sem descrição. Nada foi carregado.',
      v_invalidos USING ERRCODE = '23514';
  END IF;

  SELECT count(*) INTO v_antes FROM public.cclasstrib_codigos;

  DELETE FROM public.cclasstrib_codigos;

  INSERT INTO public.cclasstrib_codigos (codigo, descricao, cst_permitidos, fonte, versao, ativo)
  SELECT
    e ->> 'codigo',
    trim(e ->> 'descricao'),
    CASE
      WHEN jsonb_typeof(e -> 'cst') = 'array'
        THEN ARRAY(SELECT jsonb_array_elements_text(e -> 'cst'))
      ELSE '{}'::text[]
    END,
    'oficial',
    trim(p_versao),
    true
  FROM jsonb_array_elements(p_linhas) e;

  GET DIAGNOSTICS v_total = ROW_COUNT;

  RETURN jsonb_build_object(
    'carregados', v_total,
    'substituiu', v_antes,
    'versao', trim(p_versao)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.carregar_cclasstrib(jsonb, text) FROM PUBLIC, anon, authenticated;

COMMENT ON FUNCTION public.carregar_cclasstrib(jsonb, text) IS
  'Substitui a tabela oficial de cClassTrib pelo conteúdo da planilha da NT. Só service_role. Valida formato de 6 dígitos antes de apagar o que existe.';

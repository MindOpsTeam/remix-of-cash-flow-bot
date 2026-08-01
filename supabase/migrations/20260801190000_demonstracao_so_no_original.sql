-- A demonstração é DESTE projeto. O remix nasce limpo.
--
-- Problema: o remix clona o banco inteiro, então o grupo Aurora, o usuário demo e
-- todo o seed de vitrine viajariam junto. Quem remixa receberia uma instalação
-- "usada", com empresas fictícias, lançamentos que não são dele e uma conta de
-- demonstração de senha pública dentro do próprio produto.
--
-- Mecanismo: `system_identifier` do cluster Postgres é único por instalação.
-- Registramos, junto de cada item da vitrine, o identificador do cluster onde ela
-- nasceu. Se o cluster atual for outro, aquela vitrine não é daqui — é herança de
-- clonagem — e é removida na primeira oportunidade.
--
-- Por que NÃO reaproveitar plataforma_bloqueada(): a trava tem uma válvula de
-- destravamento documentada (DELETE FROM platform_lock). Se a demo dependesse
-- dela, destravar o original para editá-lo apagaria a própria demonstração. São
-- duas perguntas diferentes ("posso escrever?" e "esta vitrine é daqui?") e cada
-- uma precisa da sua própria fonte.
--
-- A remoção falha para o lado seguro: só apaga o que está explicitamente
-- registrado como vitrine E com identificador de OUTRO cluster. Dado criado pelo
-- remixador nunca entra nessa lista, então nunca é alcançado.

CREATE TABLE IF NOT EXISTS public.demo_dataset (
  tipo text NOT NULL CHECK (tipo IN ('company', 'user')),
  ref uuid NOT NULL,
  system_identifier text NOT NULL,
  registrado_em timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tipo, ref)
);

ALTER TABLE public.demo_dataset ENABLE ROW LEVEL SECURITY;

-- Leitura livre: a tela de login precisa saber se oferece o botão de demonstração
-- ANTES de existir sessão. Escrita: ninguém pelo PostgREST, só service_role/SQL.
DROP POLICY IF EXISTS "Todos leem o registro da vitrine" ON public.demo_dataset;
CREATE POLICY "Todos leem o registro da vitrine" ON public.demo_dataset FOR SELECT USING (true);

/**
 * Recalcula o registro da vitrine a partir das contas de demonstração.
 *
 * A verdade sobre "o que é vitrine" é: as contas demo e TODA empresa da qual elas
 * participam. Derivar em vez de listar à mão é o que mantém o registro correto
 * quando o seed muda — uma empresa nova no seed entra sozinha.
 */
CREATE OR REPLACE FUNCTION public.registrar_demonstracao()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id text := (SELECT system_identifier::text FROM pg_control_system());
  v_total integer;
BEGIN
  INSERT INTO public.demo_dataset (tipo, ref, system_identifier)
  SELECT 'user', u.id, v_id
    FROM auth.users u
   WHERE u.email IN ('demo@financeai.app', 'dono-demo@financeai.app')
  ON CONFLICT (tipo, ref) DO UPDATE SET system_identifier = EXCLUDED.system_identifier;

  INSERT INTO public.demo_dataset (tipo, ref, system_identifier)
  SELECT DISTINCT 'company', m.company_id, v_id
    FROM public.company_members m
    JOIN auth.users u ON u.id = m.user_id
   WHERE u.email IN ('demo@financeai.app', 'dono-demo@financeai.app')
  ON CONFLICT (tipo, ref) DO UPDATE SET system_identifier = EXCLUDED.system_identifier;

  SELECT count(*) INTO v_total FROM public.demo_dataset;
  RETURN v_total;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.registrar_demonstracao() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.registrar_demonstracao() TO service_role;

/**
 * A vitrine é deste banco?
 *
 * Só é verdade se houver conta de demonstração registrada COM o identificador do
 * cluster atual. Num remix o identificador não bate e a resposta é não, mesmo
 * antes de a limpeza rodar — assim a tela nunca oferece um login que não existe.
 */
CREATE OR REPLACE FUNCTION public.demonstracao_disponivel()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.demo_dataset d
     WHERE d.tipo = 'user'
       AND d.system_identifier = (SELECT system_identifier::text FROM pg_control_system())
  );
$$;

GRANT EXECUTE ON FUNCTION public.demonstracao_disponivel() TO anon, authenticated, service_role;

/**
 * Remove a vitrine herdada por clonagem. No banco original é no-op.
 *
 * Segura de chamar por qualquer um, inclusive anônimo, porque o que ela apaga não
 * é escolhido por quem chama: é exatamente o conjunto registrado como vitrine com
 * identificador de OUTRO cluster. No original esse conjunto é vazio por definição.
 *
 * Ordem importa: três tabelas apontam para companies sem ON DELETE CASCADE
 * (transactions.counterparty_company_id, whatsapp_configs, whatsapp_messages).
 * Sem apagá-las antes, o DELETE da empresa falha e a limpeza inteira aborta.
 */
CREATE OR REPLACE FUNCTION public.limpar_demonstracao_se_remixado()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id text := (SELECT system_identifier::text FROM pg_control_system());
  v_empresas uuid[];
  v_usuarios uuid[];
BEGIN
  SELECT array_agg(ref) INTO v_empresas
    FROM public.demo_dataset WHERE tipo = 'company' AND system_identifier <> v_id;
  SELECT array_agg(ref) INTO v_usuarios
    FROM public.demo_dataset WHERE tipo = 'user' AND system_identifier <> v_id;

  IF v_empresas IS NULL AND v_usuarios IS NULL THEN
    RETURN jsonb_build_object('removida', false, 'motivo', 'a vitrine deste banco é daqui');
  END IF;

  IF v_empresas IS NOT NULL THEN
    -- Primeiro o que não cascateia, senão o DELETE da empresa é recusado.
    DELETE FROM public.whatsapp_messages WHERE company_id = ANY(v_empresas);
    DELETE FROM public.whatsapp_configs  WHERE company_id = ANY(v_empresas);
    -- transactions referencia companies duas vezes: pela dona e pela contraparte.
    -- Apagar por qualquer um dos lados evita a FK de contraparte travar o delete.
    DELETE FROM public.transactions
     WHERE company_id = ANY(v_empresas) OR counterparty_company_id = ANY(v_empresas);
    DELETE FROM public.companies WHERE id = ANY(v_empresas);
  END IF;

  IF v_usuarios IS NOT NULL THEN
    DELETE FROM auth.users WHERE id = ANY(v_usuarios);
  END IF;

  DELETE FROM public.demo_dataset WHERE system_identifier <> v_id;

  RETURN jsonb_build_object(
    'removida', true,
    'empresas', COALESCE(array_length(v_empresas, 1), 0),
    'usuarios', COALESCE(array_length(v_usuarios, 1), 0)
  );
END;
$$;

-- Anônimo pode chamar de propósito: num remix recém-criado ninguém está logado
-- ainda, e a limpeza precisa acontecer antes de a primeira pessoa ver a vitrine
-- de outro. A função não aceita parâmetro e não decide nada a partir de quem
-- chama, então expor não amplia o que ela é capaz de apagar.
GRANT EXECUTE ON FUNCTION public.limpar_demonstracao_se_remixado() TO anon, authenticated, service_role;

-- Registra a vitrine atual como pertencente a ESTE cluster.
SELECT public.registrar_demonstracao();

COMMENT ON TABLE public.demo_dataset IS
  'Registro do que é vitrine e de onde ela nasceu. Se o system_identifier não for o do cluster atual, a vitrine veio por clonagem e limpar_demonstracao_se_remixado() a remove.';

-- Dado de referência tem que chegar sem depender de migration rodar.
--
-- Descoberto no teste de remix: o Lovable provisiona o banco novo com a
-- ESTRUTURA do schema public, mas não executa as migrations nem copia dados.
-- Resultado: `plans` chegava VAZIA, e como `companies.plan_key` tem default
-- 'trial' com FK para `plans`, criar a primeira empresa quebrava com violação de
-- chave estrangeira. A instalação nova não saía do zero.
--
-- Não adianta "mais uma migration com INSERT": ela também não roda. A garantia
-- precisa estar numa FUNÇÃO que o app chama, porque função sobrevive à cópia de
-- estrutura. Idempotente por ON CONFLICT — rodar mil vezes é o mesmo que uma.
--
-- Municípios NÃO entram aqui de propósito: são 5.571 linhas que a edge function
-- tax-rates-sync busca na API do IBGE. Dado grande com fonte oficial se carrega,
-- não se versiona.

CREATE OR REPLACE FUNCTION public.garantir_planos()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_total integer;
BEGIN
  INSERT INTO public.plans (key, nome, preco_centavos, max_agentes, max_widgets, whatsapp, pdv, contaazul) VALUES
    ('trial', 'Avaliação', 0, -1, -1, true, true, true),
    ('base',  'Base',      14900, 1, 2, false, false, false),
    ('pro',   'Pro',       34900, -1, -1, true, true, true)
  ON CONFLICT (key) DO NOTHING;

  SELECT count(*) INTO v_total FROM public.plans;
  RETURN v_total;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.garantir_planos() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.garantir_planos() TO authenticated, service_role;

SELECT public.garantir_planos();

COMMENT ON FUNCTION public.garantir_planos() IS
  'Garante os planos base. Existe porque o remix do Lovable copia a estrutura sem executar migrations: um INSERT em migration nunca chega no banco novo, e sem plano a criação de empresa quebra por FK.';

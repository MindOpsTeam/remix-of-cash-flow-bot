-- Sem planos pagos: todo remix nasce com tudo liberado.
--
-- O produto é entregue como template whitelabel — quem remixa é dono da própria
-- instalação e não paga mensalidade para ninguém. Ter "Base R$ 149" e "Pro
-- R$ 349" na tela era simplesmente falso: nenhum limite era aplicado no banco
-- (não havia gatilho nem check por plano), então a tela prometia uma cobrança
-- que não existia e uma restrição que nunca acontecia.
--
-- A tabela `plans` continua existindo porque companies.plan_key tem FK para ela,
-- mas passa a ter UMA linha, com tudo ilimitado e preço zero. Isso mantém o
-- schema íntegro sem fingir que há venda.

CREATE OR REPLACE FUNCTION public.garantir_planos()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_total integer;
BEGIN
  -- Um plano só, e ele libera tudo. -1 significa ilimitado.
  INSERT INTO public.plans (key, nome, preco_centavos, max_agentes, max_widgets, whatsapp, pdv, contaazul)
  VALUES ('trial', 'Completo', 0, -1, -1, true, true, true)
  ON CONFLICT (key) DO UPDATE
    SET nome = EXCLUDED.nome,
        preco_centavos = 0,
        max_agentes = -1,
        max_widgets = -1,
        whatsapp = true,
        pdv = true,
        contaazul = true;

  -- Planos pagos herdados de quando o produto era SaaS: as empresas que estavam
  -- neles voltam para o único plano que existe, senão a FK quebraria ao apagar.
  UPDATE public.companies SET plan_key = 'trial' WHERE plan_key <> 'trial';
  DELETE FROM public.plans WHERE key <> 'trial';

  SELECT count(*) INTO v_total FROM public.plans;
  RETURN v_total;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.garantir_planos() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.garantir_planos() TO authenticated, service_role;

SELECT public.garantir_planos();

COMMENT ON TABLE public.plans IS
  'Existe só para satisfazer a FK de companies.plan_key. UMA linha, tudo ilimitado, preço zero — o produto é entregue por remix, sem mensalidade.';

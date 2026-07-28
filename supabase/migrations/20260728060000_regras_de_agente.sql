-- Os agentes ganham regra, e o de cobrança ganha o que cobrar.
--
-- Dois problemas, e o segundo é o que explica por que `agent_actions` tem ZERO
-- linhas em produção:
--
--   1. As regras eram constantes no código: DIAS_ANTECEDENCIA = 3,
--      FATOR_ANOMALIA = 3, VALOR_MINIMO = 500, JANELA_DIAS = 7. Cada empresa
--      cobra de um jeito e considera "gasto fora da curva" outra coisa, então
--      constante no código é palpite nosso valendo para todo mundo.
--
--   2. O agente de cobrança lia SOMENTE `company_asaas_payments`, tabela com 0
--      linhas em produção. Para quem não usa Asaas, que é praticamente todo
--      mundo, ele era mudo por construção. Não tinha bug de tela nenhum: ele
--      nunca teve o que cobrar.
--
-- Esta migration cria a configuração por empresa. A leitura de `receivables`
-- pelo agente de cobrança vem no código da função.

CREATE TABLE IF NOT EXISTS public.agent_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  agent text NOT NULL CHECK (agent IN ('collections', 'anomalies', 'close', 'alerts')),
  ativo boolean NOT NULL DEFAULT true,
  -- Config é jsonb de propósito: cada agente tem parâmetros diferentes e a
  -- alternativa seria uma tabela larga cheia de coluna nula. Os padrões e a
  -- validação vivem em supabase/functions/_shared/agentes.ts, num lugar só.
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, agent)
);

ALTER TABLE public.agent_rules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members manage agent rules" ON public.agent_rules;
CREATE POLICY "Members manage agent rules" ON public.agent_rules
  FOR ALL TO authenticated
  USING (public.is_company_member(company_id))
  WITH CHECK (public.is_company_member(company_id));

REVOKE ALL ON public.agent_rules FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.agent_rules TO authenticated;

CREATE INDEX IF NOT EXISTS agent_rules_company_idx ON public.agent_rules (company_id);

COMMENT ON TABLE public.agent_rules IS
  'Configuração por empresa de cada agente: ligado/desligado e parâmetros. Padrões em _shared/agentes.ts.';

-- O agente de cobrança precisa achar o recebível em aberto rápido, por empresa
-- e por vencimento. Sem isto ele varre a tabela toda a cada execução.
CREATE INDEX IF NOT EXISTS receivables_company_status_due_idx
  ON public.receivables (company_id, status, due_date);

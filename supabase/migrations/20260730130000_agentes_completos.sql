-- Agentes completos: notificações in-app, instâncias configuráveis e canal.
--
-- Três coisas nesta migration:
--
--   1. `notifications` — o sino do app deixa de ser enfeite. Agentes escrevem
--      aqui (via service role, por isso NÃO há policy de INSERT p/ membros) e
--      o membro lê/marca como lida. `dedupe_key` + janela de dias evita que o
--      mesmo aviso chegue todo dia.
--
--   2. `agent_instances` — um "agente" vira uma linha configurável. Vários
--      ativos por empresa, cada um com config e canais próprios. Os dois
--      agentes nativos (cobrança/anomalia) continuam em agent_rules e nas
--      edges próprias; aqui vivem só os templates do agent-runner — uma fonte
--      de configuração por agente, sem espelho pra divergir.
--
--   3. Conserto do CHECK de agent_actions (agent_rules aceita 'anomalies' mas
--      agent_actions não aceitava, obrigando o agente de anomalias a se
--      registrar como 'alerts') e destinatário explícito de WhatsApp — o
--      smart-alerts descartava alerta em silêncio quando ninguém nunca tinha
--      escrito pro bot.

CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  user_id uuid,
  titulo text NOT NULL,
  corpo text,
  categoria text NOT NULL DEFAULT 'agente',
  link text,
  lida boolean NOT NULL DEFAULT false,
  dedupe_key text,
  agent_instance_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members read notifications" ON public.notifications;
CREATE POLICY "Members read notifications"
  ON public.notifications FOR SELECT
  USING (public.is_company_member(company_id));

DROP POLICY IF EXISTS "Members mark notifications read" ON public.notifications;
CREATE POLICY "Members mark notifications read"
  ON public.notifications FOR UPDATE
  USING (public.is_company_member(company_id))
  WITH CHECK (public.is_company_member(company_id));

CREATE INDEX IF NOT EXISTS idx_notifications_company_lida
  ON public.notifications (company_id, lida, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_dedupe
  ON public.notifications (company_id, dedupe_key, created_at DESC);

CREATE TABLE IF NOT EXISTS public.agent_instances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  template_key text NOT NULL,
  nome text NOT NULL,
  ativo boolean NOT NULL DEFAULT true,
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  canais jsonb NOT NULL DEFAULT '{"inapp": true, "whatsapp": false}'::jsonb,
  last_run_at timestamptz,
  last_result jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.agent_instances ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members manage agent instances" ON public.agent_instances;
CREATE POLICY "Members manage agent instances"
  ON public.agent_instances FOR ALL
  USING (public.is_company_member(company_id))
  WITH CHECK (public.is_company_member(company_id));

CREATE INDEX IF NOT EXISTS idx_agent_instances_company
  ON public.agent_instances (company_id, ativo);

-- O enum de agent_actions passa a aceitar o agente de anomalias com o nome
-- verdadeiro e o runner genérico.
ALTER TABLE public.agent_actions DROP CONSTRAINT IF EXISTS agent_actions_agent_check;
ALTER TABLE public.agent_actions
  ADD CONSTRAINT agent_actions_agent_check
  CHECK (agent IN ('collections', 'close', 'alerts', 'anomalies', 'runner'));

-- Destinatário explícito dos avisos por WhatsApp. Sem ele, o canal fica
-- visivelmente "não configurado" na UI — nunca mais descarte silencioso.
ALTER TABLE public.whatsapp_configs ADD COLUMN IF NOT EXISTS notify_number text;

-- Agendamento do runner: depois dos agentes nativos, antes da cobrança.
SELECT cron.schedule(
  'agent-runner-daily',
  '45 11 * * *',
  $$SELECT public.chamar_funcao_agendada('agent-runner')$$
);


-- ============================================================
-- Tabela: whatsapp_pending_actions
-- Armazena confirmações pendentes do motor WhatsApp quando
-- a IA tem baixa confiança na classificação PF vs PJ.
-- Expira automaticamente em 10 minutos.
-- ============================================================

CREATE TABLE public.whatsapp_pending_actions (
  id            uuid        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id    uuid        NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  user_id       uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  phone_number  text        NOT NULL,
  instance_name text        NOT NULL,
  -- JSON com a ação pendente:
  -- { action, side, amount, description, date,
  --   pj_account_id?, pj_cost_center_id?, pj_bank_account_id?,
  --   pf_category_id?, pf_account_id?, reason }
  pending_action jsonb      NOT NULL,
  expires_at    timestamptz NOT NULL DEFAULT now() + interval '10 minutes',
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_whatsapp_pending_phone
  ON public.whatsapp_pending_actions (phone_number, company_id);

CREATE INDEX idx_whatsapp_pending_expires
  ON public.whatsapp_pending_actions (expires_at);

-- Apenas service role (edge functions) acessa esta tabela.
-- Não expõe dados ao cliente browser.
ALTER TABLE public.whatsapp_pending_actions ENABLE ROW LEVEL SECURITY;

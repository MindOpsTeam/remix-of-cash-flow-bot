
-- WhatsApp configuration table
CREATE TABLE public.whatsapp_configs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id),
  instance_name TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.whatsapp_configs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view whatsapp configs"
  ON public.whatsapp_configs FOR SELECT
  USING (is_company_member(company_id));

CREATE POLICY "Members can create whatsapp configs"
  ON public.whatsapp_configs FOR INSERT
  WITH CHECK (is_company_member(company_id));

CREATE POLICY "Members can update whatsapp configs"
  ON public.whatsapp_configs FOR UPDATE
  USING (is_company_member(company_id));

CREATE POLICY "Members can delete whatsapp configs"
  ON public.whatsapp_configs FOR DELETE
  USING (is_company_member(company_id));

CREATE TRIGGER update_whatsapp_configs_updated_at
  BEFORE UPDATE ON public.whatsapp_configs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- WhatsApp message logs
CREATE TABLE public.whatsapp_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id),
  config_id UUID NOT NULL REFERENCES public.whatsapp_configs(id) ON DELETE CASCADE,
  phone_number TEXT NOT NULL,
  direction TEXT NOT NULL DEFAULT 'inbound',
  message_text TEXT,
  message_type TEXT NOT NULL DEFAULT 'text',
  processed BOOLEAN NOT NULL DEFAULT false,
  classification JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.whatsapp_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view whatsapp messages"
  ON public.whatsapp_messages FOR SELECT
  USING (is_company_member(company_id));

CREATE POLICY "Members can create whatsapp messages"
  ON public.whatsapp_messages FOR INSERT
  WITH CHECK (is_company_member(company_id));

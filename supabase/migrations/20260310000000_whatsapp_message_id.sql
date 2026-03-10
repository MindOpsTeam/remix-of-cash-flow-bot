-- Adiciona coluna message_id na tabela whatsapp_messages
-- para deduplicação de mensagens reenviadas pela Evolution API.

ALTER TABLE public.whatsapp_messages
  ADD COLUMN IF NOT EXISTS message_id TEXT;

-- Índice único para evitar processamento duplicado por empresa
CREATE UNIQUE INDEX IF NOT EXISTS idx_whatsapp_messages_dedup
  ON public.whatsapp_messages (company_id, message_id)
  WHERE message_id IS NOT NULL;

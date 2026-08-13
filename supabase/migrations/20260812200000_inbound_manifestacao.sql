-- Resíduo da revisão (Estr-A3): Manifestação do Destinatário (MDe). Registra quando
-- a empresa deu Ciência da Operação (ou outra manifestação) na NF-e destinada, para
-- rastrear o prazo legal e liberar o acesso ao XML completo (duplicatas/itens).
ALTER TABLE public.inbound_documents
  ADD COLUMN IF NOT EXISTS manifestacao_at timestamptz;

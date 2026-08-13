-- Resíduo da revisão (2026-08-12): endurece a emissão e liga o cancelamento fiscal.
--   (7/Tec-C2) claim-first: sob concorrência/retry sem confirmação, duas requisições
--       podiam transmitir a MESMA nota duas vezes ao SEFIN. O índice único abaixo faz
--       o rascunho reservado por idempotency_key barrar a 2ª transmissão.
--   (2/Estr-A1) cancelamento no ADN: a NFS-e cancelada guarda o XML do evento; o
--       trigger de estorno (migration anterior) zera o recebível em aberto.

-- Guarda do XML do evento de cancelamento registrado no SEFIN (guarda fiscal 5 anos).
ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS nfse_evento_xml text;

-- Claim-first: uma só emissão em voo por idempotency_key, por empresa.
-- (Parcial: só vale quando há chave; emissões avulsas sem chave não são travadas.)
CREATE UNIQUE INDEX IF NOT EXISTS invoices_company_idempotency_uidx
  ON public.invoices (company_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

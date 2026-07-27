-- Seis tabelas tinham company_id solto, sem chave estrangeira para companies:
-- aceitavam empresa inexistente e não cascateavam na exclusão do tenant.
-- Achado pela varredura de docs/plataforma-modelo.json (tipo fk_ausente).
--
-- Todas estavam com 0 linhas quando a restrição foi aplicada, então não houve
-- risco de violar dado existente.

ALTER TABLE public.company_asaas_anticipations
  ADD CONSTRAINT company_asaas_anticipations_company_id_fkey
  FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;

ALTER TABLE public.company_asaas_bills
  ADD CONSTRAINT company_asaas_bills_company_id_fkey
  FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;

ALTER TABLE public.company_asaas_invoices
  ADD CONSTRAINT company_asaas_invoices_company_id_fkey
  FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;

ALTER TABLE public.company_asaas_subscriptions
  ADD CONSTRAINT company_asaas_subscriptions_company_id_fkey
  FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;

ALTER TABLE public.company_asaas_transfers
  ADD CONSTRAINT company_asaas_transfers_company_id_fkey
  FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;

ALTER TABLE public.reconciliation_log
  ADD CONSTRAINT reconciliation_log_company_id_fkey
  FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;

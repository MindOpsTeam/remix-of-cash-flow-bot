-- Colunas de recorrência em bills_payable.
--
-- Foram aplicadas em produção em 27/07 pelo agente do Lovable (registro
-- 20260727203202 em supabase_migrations.schema_migrations) junto com uma tela de
-- "conta recorrente". Em seguida o projeto foi revertido para o commit a7adc70
-- (commit e0868ac, "Reverted to commit a7adc70"), o que apagou a tela e o
-- arquivo de migration do repositório, MAS não desfez nada no banco.
--
-- Resultado: produção tinha colunas que nenhuma migration versionada descrevia.
-- Este arquivo apenas re-registra o que já existe no banco, para o schema voltar
-- a ser reproduzível. É idempotente e aditivo: não altera dado nem o DRE. As
-- colunas ficam sem uso enquanto a tela de recorrência não voltar.

ALTER TABLE public.bills_payable
  ADD COLUMN IF NOT EXISTS is_recurring boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS recurrence_group_id uuid,
  ADD COLUMN IF NOT EXISTS recurrence_index integer,
  ADD COLUMN IF NOT EXISTS recurrence_total integer;

CREATE INDEX IF NOT EXISTS bills_payable_recurrence_group_idx
  ON public.bills_payable (recurrence_group_id)
  WHERE recurrence_group_id IS NOT NULL;

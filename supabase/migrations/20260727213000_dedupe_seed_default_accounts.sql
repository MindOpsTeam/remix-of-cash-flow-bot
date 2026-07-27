-- Plano de contas, centros de custo e conta bancária vinham DUPLICADOS em toda
-- empresa criada, porque `companies` tinha DOIS gatilhos AFTER INSERT chamando
-- a mesma `seed_default_accounts()`:
--   on_company_created  +  trg_seed_default_accounts
-- (e, de quebra, dois BEFORE UPDATE idênticos de updated_at).
--
-- Efeito visível: 32 contas em vez de 16, 10 centros de custo em vez de 5 e 2
-- "Banco Inter – Conta Principal" por empresa. Todo seletor de conta contábil e
-- o agrupamento do DRE mostravam cada linha duas vezes.
--
-- Este bug é ANTERIOR aos commits do agente do Lovable de 27/07.
--
-- Em produção a limpeza foi executada com backup completo no schema
-- `backup_20260727` (chart_of_accounts, cost_centers, bank_accounts + as tabelas
-- de mapeamento map_coa/map_cc/map_ba, que permitem desfazer o remapeamento).
-- Nenhuma duplicata tinha sido editada pelo usuário (todas editable = false) e
-- só 22 lançamentos apontavam para a cópia removida; foram remapeados para a
-- linha sobrevivente antes do DELETE, sem órfãos.

-- 1) Causa raiz: um gatilho de seed basta.
DROP TRIGGER IF EXISTS trg_seed_default_accounts ON public.companies;
DROP TRIGGER IF EXISTS trg_updated_at ON public.companies;

-- 2) Limpeza dos dados já duplicados (no-op em base limpa).
CREATE TEMP TABLE IF NOT EXISTS _map_coa AS
WITH ranked AS (
  SELECT id, first_value(id) OVER (PARTITION BY company_id, code ORDER BY created_at, id) AS keep_id,
         row_number() OVER (PARTITION BY company_id, code ORDER BY created_at, id) AS rn
  FROM public.chart_of_accounts)
SELECT id AS loser_id, keep_id FROM ranked WHERE rn > 1;

CREATE TEMP TABLE IF NOT EXISTS _map_cc AS
WITH ranked AS (
  SELECT id, first_value(id) OVER (PARTITION BY company_id, name ORDER BY created_at, id) AS keep_id,
         row_number() OVER (PARTITION BY company_id, name ORDER BY created_at, id) AS rn
  FROM public.cost_centers)
SELECT id AS loser_id, keep_id FROM ranked WHERE rn > 1;

CREATE TEMP TABLE IF NOT EXISTS _map_ba AS
WITH ranked AS (
  SELECT id, first_value(id) OVER (PARTITION BY company_id, name ORDER BY created_at, id) AS keep_id,
         row_number() OVER (PARTITION BY company_id, name ORDER BY created_at, id) AS rn
  FROM public.bank_accounts)
SELECT id AS loser_id, keep_id FROM ranked WHERE rn > 1;

UPDATE public.transactions t SET account_id = m.keep_id FROM _map_coa m WHERE t.account_id = m.loser_id;
UPDATE public.transactions t SET cost_center_id = m.keep_id FROM _map_cc m WHERE t.cost_center_id = m.loser_id;
UPDATE public.transactions t SET bank_account_id = m.keep_id FROM _map_ba m WHERE t.bank_account_id = m.loser_id;
UPDATE public.receivables r SET account_id = m.keep_id FROM _map_coa m WHERE r.account_id = m.loser_id;
UPDATE public.receivables r SET cost_center_id = m.keep_id FROM _map_cc m WHERE r.cost_center_id = m.loser_id;
UPDATE public.contracts c SET account_id = m.keep_id FROM _map_coa m WHERE c.account_id = m.loser_id;
UPDATE public.contracts c SET cost_center_id = m.keep_id FROM _map_cc m WHERE c.cost_center_id = m.loser_id;
UPDATE public.products p SET account_id = m.keep_id FROM _map_coa m WHERE p.account_id = m.loser_id;
UPDATE public.webhooks w SET default_account_id = m.keep_id FROM _map_coa m WHERE w.default_account_id = m.loser_id;
UPDATE public.webhooks w SET default_cost_center_id = m.keep_id FROM _map_cc m WHERE w.default_cost_center_id = m.loser_id;
UPDATE public.chart_of_accounts a SET parent_id = m.keep_id FROM _map_coa m WHERE a.parent_id = m.loser_id;
UPDATE public.inter_config i SET bank_account_id = m.keep_id FROM _map_ba m WHERE i.bank_account_id = m.loser_id;
UPDATE public.owner_transactions o SET pj_bank_account_id = m.keep_id FROM _map_ba m WHERE o.pj_bank_account_id = m.loser_id;

DELETE FROM public.chart_of_accounts WHERE id IN (SELECT loser_id FROM _map_coa);
DELETE FROM public.cost_centers      WHERE id IN (SELECT loser_id FROM _map_cc);
DELETE FROM public.bank_accounts     WHERE id IN (SELECT loser_id FROM _map_ba);

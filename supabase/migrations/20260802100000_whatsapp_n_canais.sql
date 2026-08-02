-- WhatsApp: N canais por empresa, com identidade própria.
--
-- Bug que isto conserta: integracoes-io.ts salvava com
-- `upsert(..., { onConflict: "company_id" })`, mas whatsapp_configs só tinha
-- unique em `id`. O Postgres recusa (42P10) e o salvamento pela central de
-- configuração e pelo wizard simplesmente não funcionava — o usuário preenchia,
-- clicava e tomava erro. Reproduzido em produção antes da correção.
--
-- A tela dedicada (/whatsapp) já tratava N canais: ela insere, lista, ativa e
-- apaga por `id`. Quem estava errado era o caminho do catálogo, que assumia um
-- só. Esta migration alinha o banco com o que o produto já fazia.
--
-- Identidade do canal = (empresa, nome da instância). É o nome da instância que
-- a Evolution API usa para rotear, então dois canais com o mesmo nome na mesma
-- empresa seriam a mesma coisa duas vezes — e é isso que a unique impede.
-- A unicidade NÃO é por company_id sozinho, de propósito: esse é justamente o
-- formato que limita a empresa a um canal.

ALTER TABLE public.whatsapp_configs
  DROP CONSTRAINT IF EXISTS whatsapp_configs_company_id_instance_name_key;

ALTER TABLE public.whatsapp_configs
  ADD CONSTRAINT whatsapp_configs_company_id_instance_name_key
  UNIQUE (company_id, instance_name);

COMMENT ON CONSTRAINT whatsapp_configs_company_id_instance_name_key ON public.whatsapp_configs IS
  'Uma empresa pode ter N canais de WhatsApp; o que não pode é dois canais com o mesmo nome de instância, porque é por ele que a Evolution roteia.';
